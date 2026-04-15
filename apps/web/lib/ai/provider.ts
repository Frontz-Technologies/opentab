import { createOpenAI } from "@ai-sdk/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createAiProvider(apiKey: string, model: string) {
  const openrouter = createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
  });

  return openrouter(model);
}
