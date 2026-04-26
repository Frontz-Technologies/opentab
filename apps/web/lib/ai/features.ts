export type AiFeature = "chat" | "extraction";

const ENV_FLAG: Record<AiFeature, string> = {
  chat: "FEATURE_AI_CHAT",
  extraction: "FEATURE_AI_EXTRACTION",
};

const ENV_MODEL: Record<AiFeature, string> = {
  chat: "AI_MODEL_CHAT",
  extraction: "AI_MODEL_EXTRACTION",
};

const DEFAULT_MODEL: Record<AiFeature, string> = {
  chat: "openai/gpt-4o-mini",
  extraction: "openai/gpt-4o",
};

export function isFeatureEnabled(feature: AiFeature): boolean {
  return process.env[ENV_FLAG[feature]] === "on";
}

export function getFeatureModel(feature: AiFeature): string {
  return process.env[ENV_MODEL[feature]] ?? DEFAULT_MODEL[feature];
}
