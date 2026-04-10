import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { GptResearcherState } from "../state.js";
import { getStringFromContent } from "../../utils.js";

const GPT_RESEARCHER_MCP_COMMAND = process.env.GPT_RESEARCHER_MCP_COMMAND || "npx";
const GPT_RESEARCHER_MCP_ARGS = process.env.GPT_RESEARCHER_MCP_ARGS
  ? process.env.GPT_RESEARCHER_MCP_ARGS.split(",").map((arg) => arg.trim())
  : ["-y", "gpt-researcher-mcp"];

/**
 * Performs deep research using the GPT Researcher MCP server.
 * Requires the `gpt-researcher-mcp` package to be available via npx, and
 * the `gpt_researcher` Python package to be installed.
 *
 * Required environment variables:
 *   - OPENAI_API_KEY (or other LLM provider keys)
 *   - TAVILY_API_KEY (recommended retriever for GPT Researcher)
 */
export async function research(
  state: GptResearcherState
): Promise<Partial<GptResearcherState>> {
  const latestMessage = state.messages[state.messages.length - 1];
  const query = getStringFromContent(latestMessage.content);

  const mcpEnv: Record<string, string> = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    TAVILY_API_KEY: process.env.TAVILY_API_KEY || "",
    ...(process.env.ANTHROPIC_API_KEY
      ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
      : {}),
    ...(process.env.GOOGLE_API_KEY
      ? { GOOGLE_API_KEY: process.env.GOOGLE_API_KEY }
      : {}),
    ...(process.env.GPT_RESEARCHER_LLM_PROVIDER
      ? {
          // Note: gpt-researcher-mcp uses lowercase 'llm_provider' for this env var
          llm_provider: process.env.GPT_RESEARCHER_LLM_PROVIDER,
        }
      : {}),
    ...(process.env.GPT_RESEARCHER_FAST_LLM
      ? { FAST_LLM: process.env.GPT_RESEARCHER_FAST_LLM }
      : {}),
    ...(process.env.GPT_RESEARCHER_SMART_LLM
      ? { SMART_LLM: process.env.GPT_RESEARCHER_SMART_LLM }
      : {}),
    ...(process.env.GPT_RESEARCHER_STRATEGIC_LLM
      ? { STRATEGIC_LLM: process.env.GPT_RESEARCHER_STRATEGIC_LLM }
      : {}),
  };

  const client = new MultiServerMCPClient({
    mcpServers: {
      "gpt-researcher": {
        transport: "stdio",
        command: GPT_RESEARCHER_MCP_COMMAND,
        args: GPT_RESEARCHER_MCP_ARGS,
        env: mcpEnv,
      },
    },
    // Skip failed connections instead of throwing, so the graph degrades gracefully.
    onConnectionError: "ignore",
    prefixToolNameWithServerName: false,
  });

  try {
    const tools = await client.getTools();
    const reportTool = tools.find((t) => t.name === "get_report");

    if (!reportTool) {
      console.warn(
        "GPT Researcher MCP: 'get_report' tool not found. " +
          "Ensure the gpt-researcher-mcp server is correctly installed and " +
          "the gpt_researcher Python package is available."
      );
      return {
        researchReport: "",
        researchComplete: false,
      };
    }

    const result = await reportTool.invoke({
      query,
      report_type: "research_report",
    });

    const report = typeof result === "string" ? result : JSON.stringify(result);

    return {
      query,
      researchReport: report,
      researchComplete: true,
    };
  } catch (error) {
    console.error("GPT Researcher MCP error:", error);
    return {
      researchReport: "",
      researchComplete: false,
    };
  } finally {
    await client.close();
  }
}
