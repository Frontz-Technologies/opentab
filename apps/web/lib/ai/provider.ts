import { createAnthropic } from "@ai-sdk/anthropic";

export function createAiProvider(apiKey: string, model: string) {
  const anthropic = createAnthropic({ apiKey });
  return anthropic(model);
}
