import { generateText, Output } from "ai";
import { z } from "zod";
import { registry } from "../registry";

// Define the router output schema
export const RouterSchema = z.object({
  target: z
    .enum(["INTERVIEW", "CHAT", "SEARCH", "EDITOR"])
    .describe("The target agent to handle the user request."),
  reasoning: z.string().describe("Brief reasoning for the routing decision."),
  parameters: z
    .record(z.string(), z.any())
    .optional()
    .describe("Extracted parameters relevant to the target agent."),
});

export type RouterOutput = z.infer<typeof RouterSchema>;

export async function routeIntent(
  input: string,
  context?: string,
): Promise<RouterOutput> {
  // Use the fast model for routing (low latency is key)
  const model = registry.fastModel;

  if (!model) {
    throw new Error("No AI model configured for routing.");
  }

  const result = await generateText({
    model,
    temperature: 0, // 🧊 绝对零度，确保分类稳定
    experimental_output: Output.object({ schema: RouterSchema }),
    system: `
      You are the Central Router for NexusNote, an AI course generator and learning assistant.
      Your job is to CLASSIFY user intent into one of four categories:

      1. **INTERVIEW**: 
         - User wants to create a new course/syllabus.
         - User is answering questions related to course creation (goals, background, time).
         - Keywords: "create course", "learn python", "syllabus", "beginner", "2 hours a week".
      
      2. **CHAT**:
         - User is asking general questions, coding help, or casual conversation.
         - User is asking about existing content (RAG).
         - Keywords: "how does react work?", "explain this code", "hello".

      3. **SEARCH**:
         - User explicitly asks to search the web or asks for real-time info.
         - Keywords: "search for", "latest news", "current weather".
      
      4. **EDITOR**:
         - User wants to modify the generated outline or document.
         - Keywords: "change chapter 1", "add a section", "rewrite this".

      **Context Awareness**:
      If 'context' is provided, use it to inform your decision. For example, if the user is in the middle of an interview (state: ASK_GOAL), even a short answer like "Python" should be routed to INTERVIEW.
    `,
    prompt: `
      Context: ${context || "None"}
      User Input: "${input}"
    `,
  });

  return result.experimental_output;
}
