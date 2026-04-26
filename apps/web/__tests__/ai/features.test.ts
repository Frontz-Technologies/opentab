import { describe, it, expect, beforeEach } from "vitest";
import {
  isFeatureEnabled,
  getFeatureModel,
  type AiFeature,
} from "../../lib/ai/features";

describe("AI feature flags (#224)", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_FEATURE_AI_CHAT;
    delete process.env.FEATURE_AI_EXTRACTION;
    delete process.env.AI_MODEL_CHAT;
    delete process.env.AI_MODEL_EXTRACTION;
  });

  it("isFeatureEnabled returns false when env unset (closed by default)", () => {
    expect(isFeatureEnabled("chat")).toBe(false);
    expect(isFeatureEnabled("extraction")).toBe(false);
  });

  it("isFeatureEnabled returns true when env=on", () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_CHAT = "on";
    process.env.FEATURE_AI_EXTRACTION = "on";
    expect(isFeatureEnabled("chat")).toBe(true);
    expect(isFeatureEnabled("extraction")).toBe(true);
  });

  it("isFeatureEnabled returns false when env=off", () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_CHAT = "off";
    expect(isFeatureEnabled("chat")).toBe(false);
  });

  it("isFeatureEnabled('chat') reads NEXT_PUBLIC_FEATURE_AI_CHAT (single source of truth for client + server)", () => {
    process.env.NEXT_PUBLIC_FEATURE_AI_CHAT = "on";
    expect(isFeatureEnabled("chat")).toBe(true);
    // The legacy server-only var should NOT enable chat anymore.
    delete process.env.NEXT_PUBLIC_FEATURE_AI_CHAT;
    process.env.FEATURE_AI_CHAT = "on";
    expect(isFeatureEnabled("chat")).toBe(false);
    delete process.env.FEATURE_AI_CHAT;
  });

  it("getFeatureModel returns env value when set", () => {
    process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
    expect(getFeatureModel("extraction")).toBe("openai/gpt-4o");
  });

  it("getFeatureModel returns documented default when unset", () => {
    expect(getFeatureModel("chat")).toBe("openai/gpt-4o-mini");
    expect(getFeatureModel("extraction")).toBe("openai/gpt-4o");
  });

  it("typed feature names cover known features", () => {
    const features: AiFeature[] = ["chat", "extraction"];
    for (const f of features) {
      expect(typeof getFeatureModel(f)).toBe("string");
    }
  });
});
