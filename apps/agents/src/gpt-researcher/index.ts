import { StateGraph, START, END } from "@langchain/langgraph";
import { GptResearcherGraphAnnotation } from "./state.js";
import { research } from "./nodes/research.js";

const builder = new StateGraph(GptResearcherGraphAnnotation)
  .addNode("research", research)
  .addEdge(START, "research")
  .addEdge("research", END);

export const graph = builder.compile();

graph.name = "GPT Researcher Graph";
