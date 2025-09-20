import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { components } from "./_generated/api";

// smart agent
export const atlasAgent = new Agent(components.agent, {
    name: "atlas-agent",
    languageModel: openai.chat("gpt-5"),
    instructions: "You are a helpful assistant."
})

// fast agent
export const atlasAgentGroq = new Agent(components.agent, {
    name: "atlas-agent-fast",
    languageModel: groq("openai/gpt-oss-120b"),
    instructions: "You are a helpful assistant."
})