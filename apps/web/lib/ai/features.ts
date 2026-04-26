export type AiFeature = "chat" | "extraction";

// Chat uses NEXT_PUBLIC_* so a single env var gates BOTH the client FAB
// (visibility) and the server route (404). One source of truth — no risk
// of "button shows but API 404s" when one is set and the other isn't.
const ENV_FLAG: Record<AiFeature, string> = {
  chat: "NEXT_PUBLIC_FEATURE_AI_CHAT",
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
