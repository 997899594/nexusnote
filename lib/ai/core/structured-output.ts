import type { LanguageModelV3 } from "@ai-sdk/provider";
import { generateText, type LanguageModelUsage, Output, type ToolSet } from "ai";
import type { z } from "zod";

type GenerateTextInput = Parameters<typeof generateText>[0];
type StructuredObjectFinishReason = Awaited<ReturnType<typeof generateText>>["finishReason"];

export interface GenerateStructuredObjectOptions<TSchema extends z.ZodType> {
  model: LanguageModelV3;
  schema: TSchema;
  name?: string;
  description?: string;
  system?: GenerateTextInput["system"];
  prompt: string;
  temperature?: GenerateTextInput["temperature"];
  maxOutputTokens?: GenerateTextInput["maxOutputTokens"];
  topP?: GenerateTextInput["topP"];
  topK?: GenerateTextInput["topK"];
  presencePenalty?: GenerateTextInput["presencePenalty"];
  frequencyPenalty?: GenerateTextInput["frequencyPenalty"];
  seed?: GenerateTextInput["seed"];
  stopSequences?: GenerateTextInput["stopSequences"];
  timeout?: GenerateTextInput["timeout"];
  maxRetries?: GenerateTextInput["maxRetries"];
}

export interface GenerateStructuredObjectResult<TOutput> {
  output: TOutput;
  usage: LanguageModelUsage;
  finishReason: StructuredObjectFinishReason;
}

export async function generateStructuredObject<TSchema extends z.ZodType>(
  options: GenerateStructuredObjectOptions<TSchema>,
): Promise<GenerateStructuredObjectResult<z.infer<TSchema>>> {
  const output = Output.object<z.infer<TSchema>>({
    schema: options.schema,
    name: options.name,
    description: options.description,
  });
  const result = await generateText<ToolSet, typeof output>({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    output,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    topP: options.topP,
    topK: options.topK,
    presencePenalty: options.presencePenalty,
    frequencyPenalty: options.frequencyPenalty,
    seed: options.seed,
    stopSequences: options.stopSequences,
    timeout: options.timeout,
    maxRetries: options.maxRetries,
  });

  return {
    output: result.output,
    usage: result.usage,
    finishReason: result.finishReason,
  };
}
