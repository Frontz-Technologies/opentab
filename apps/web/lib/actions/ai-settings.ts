"use server";

import { generateText } from "ai";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiSettings } from "@opentab/db/schema";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { encryptApiKey, decryptApiKey } from "@/lib/ai/encryption";
import { createAiProvider } from "@/lib/ai/provider";
import { createLogger } from "@/lib/logging/logger";
import { getFeatureModel, type AiFeature } from "@/lib/ai/features";

const log = createLogger("ai-settings");

const updateAiSettingsSchema = z.object({
  enabled: z.boolean(),
  chatModel: z.string().min(1).max(100).nullable(),
  extractionModel: z.string().min(1).max(100).nullable(),
  apiKey: z.string().trim().optional().default(""),
  receiptExtractionEnabled: z.boolean().default(true),
});

export type AiSettingsPublic = {
  enabled: boolean;
  chatModel: string | null;
  extractionModel: string | null;
  apiKeyLast4: string | null;
  hasApiKey: boolean;
  receiptExtractionEnabled: boolean;
  apiKeyOverriddenByEnv: boolean;
  chatModelOverriddenByEnv: boolean;
  extractionModelOverriddenByEnv: boolean;
};

function assertSettingsAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Forbidden");
  }
}

async function getAiSettingsRow(orgId: string) {
  const [settings] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.orgId, orgId))
    .limit(1);

  return settings ?? null;
}

export async function getAiSettings(
  orgId: string,
): Promise<AiSettingsPublic | null> {
  const settings = await getAiSettingsRow(orgId);
  if (!settings) return null;

  return {
    enabled: settings.enabled,
    chatModel: settings.chatModel ?? null,
    extractionModel: settings.extractionModel ?? null,
    apiKeyLast4: settings.apiKeyLast4 ?? null,
    hasApiKey: Boolean(settings.apiKeyEncrypted),
    receiptExtractionEnabled: settings.receiptExtractionEnabled,
    apiKeyOverriddenByEnv: Boolean(process.env.OPENROUTER_API_KEY),
    chatModelOverriddenByEnv: Boolean(process.env.AI_MODEL_CHAT),
    extractionModelOverriddenByEnv: Boolean(process.env.AI_MODEL_EXTRACTION),
  };
}

export async function getAiSettingsSecret(
  orgId: string,
  feature: AiFeature,
): Promise<{ apiKey: string; model: string } | null> {
  const envApiKey = process.env.OPENROUTER_API_KEY;
  const envModel = getFeatureModel(feature);

  let apiKey: string | undefined = envApiKey;
  let dbRow: Awaited<ReturnType<typeof getAiSettingsRow>> | undefined =
    undefined;

  if (!apiKey) {
    dbRow = await getAiSettingsRow(orgId);
    if (dbRow?.apiKeyEncrypted && dbRow?.apiKeyIv) {
      apiKey = decryptApiKey(dbRow.apiKeyEncrypted, dbRow.apiKeyIv);
    }
  }
  if (!apiKey) return null;

  let model: string | null = envModel;
  if (!model) {
    if (dbRow === undefined) dbRow = await getAiSettingsRow(orgId);
    model =
      feature === "chat"
        ? (dbRow?.chatModel ?? null)
        : (dbRow?.extractionModel ?? null);
  }
  if (!model) return null;

  return { apiKey, model };
}

export async function updateAiSettings(input: unknown) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  assertSettingsAdmin(session.role);

  const orgId = session.org.id;
  log.info("AI settings update started", { orgId });

  const parsed = updateAiSettingsSchema.safeParse(input);
  if (!parsed.success) {
    log.warn("AI settings validation failed", { orgId });
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const existing = await getAiSettingsRow(orgId);
  const next = parsed.data;

  // Env-overridden columns are read-only at the API surface — preserve
  // the existing DB value rather than letting the client overwrite a
  // value that's hidden behind a "Set by deployment" pill in the UI.
  const apiKeyOverridden = Boolean(process.env.OPENROUTER_API_KEY);
  const chatOverridden = Boolean(process.env.AI_MODEL_CHAT);
  const extractionOverridden = Boolean(process.env.AI_MODEL_EXTRACTION);

  let encryptedKey: ReturnType<typeof encryptApiKey> | null = null;
  if (next.apiKey && !apiKeyOverridden) {
    try {
      encryptedKey = encryptApiKey(next.apiKey);
    } catch {
      log.error("encryption key not configured", { orgId });
      return {
        success: false,
        error: {
          _: [
            "AI_ENCRYPTION_KEY is not configured. Add it to your docker/.env file: AI_ENCRYPTION_KEY=$(openssl rand -hex 32)",
          ],
        },
      };
    }
  }

  const nextChatModel = chatOverridden
    ? (existing?.chatModel ?? null)
    : (next.chatModel ?? null);
  const nextExtractionModel = extractionOverridden
    ? (existing?.extractionModel ?? null)
    : (next.extractionModel ?? null);
  const nextApiKeyEncrypted = apiKeyOverridden
    ? (existing?.apiKeyEncrypted ?? null)
    : (encryptedKey?.encrypted ?? existing?.apiKeyEncrypted ?? null);
  const nextApiKeyIv = apiKeyOverridden
    ? (existing?.apiKeyIv ?? null)
    : (encryptedKey?.iv ?? existing?.apiKeyIv ?? null);
  const nextApiKeyLast4 = apiKeyOverridden
    ? (existing?.apiKeyLast4 ?? null)
    : (encryptedKey?.last4 ?? existing?.apiKeyLast4 ?? null);

  if (existing) {
    await db
      .update(aiSettings)
      .set({
        enabled: next.enabled,
        chatModel: nextChatModel,
        extractionModel: nextExtractionModel,
        receiptExtractionEnabled: next.receiptExtractionEnabled,
        apiKeyEncrypted: nextApiKeyEncrypted,
        apiKeyIv: nextApiKeyIv,
        apiKeyLast4: nextApiKeyLast4,
        updatedAt: new Date(),
      })
      .where(eq(aiSettings.id, existing.id));
  } else {
    await db.insert(aiSettings).values({
      orgId,
      enabled: next.enabled,
      chatModel: nextChatModel,
      extractionModel: nextExtractionModel,
      receiptExtractionEnabled: next.receiptExtractionEnabled,
      apiKeyEncrypted: nextApiKeyEncrypted,
      apiKeyIv: nextApiKeyIv,
      apiKeyLast4: nextApiKeyLast4,
    });
  }

  log.info("AI settings updated", {
    orgId,
    enabled: next.enabled,
    chatModel: nextChatModel,
    extractionModel: nextExtractionModel,
    receiptExtractionEnabled: next.receiptExtractionEnabled,
    apiKeyChanged: !!encryptedKey,
  });

  revalidatePath("/settings/ai");
  return { success: true };
}

export async function deleteApiKey(orgId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  assertSettingsAdmin(session.role);

  await db
    .update(aiSettings)
    .set({
      apiKeyEncrypted: null,
      apiKeyIv: null,
      apiKeyLast4: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(aiSettings.orgId, orgId), eq(aiSettings.orgId, session.org.id)),
    );

  log.info("API key deleted", { orgId: session.org.id });

  revalidatePath("/settings/ai");
  return { success: true };
}

export async function testAiConnection(orgId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  assertSettingsAdmin(session.role);
  if (session.org.id !== orgId) throw new Error("Forbidden");

  // Test against the extraction feature — that's the surface most likely
  // to need a working key (PDF/receipt OCR). If chat is the only feature
  // configured, fall back to that.
  const settings =
    (await getAiSettingsSecret(orgId, "extraction")) ??
    (await getAiSettingsSecret(orgId, "chat"));
  if (!settings?.apiKey) {
    return { success: false, error: "No API key configured" };
  }

  const done = log.time("ai-connection-test");
  try {
    const model = createAiProvider(settings.apiKey, settings.model);
    await generateText({
      model,
      prompt: "Hi",
      maxOutputTokens: 5,
    });

    done("AI connection test succeeded", { orgId });
    return { success: true };
  } catch (error) {
    done("AI connection test failed", { orgId });
    log.error("AI connection test error", {
      orgId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

export type ModelCapabilities = {
  text: boolean;
  image: boolean;
  file: boolean;
};

export async function getModelCapabilities(
  model: string,
): Promise<ModelCapabilities> {
  const defaults: ModelCapabilities = { text: true, image: false, file: false };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return defaults;
    const data = (await res.json()) as {
      data: Array<{
        id: string;
        architecture?: { input_modalities?: string[] };
      }>;
    };
    const found = data.data.find((m) => m.id === model);
    if (!found?.architecture?.input_modalities) return defaults;
    const modalities = found.architecture.input_modalities;
    return {
      text: modalities.includes("text"),
      image: modalities.includes("image"),
      file: modalities.includes("file"),
    };
  } catch {
    return defaults;
  }
}

export async function isReceiptExtractionEnabled(
  orgId: string,
): Promise<boolean> {
  if (process.env.OPENROUTER_API_KEY) return true;

  const settings = await getAiSettingsRow(orgId);
  if (!settings) return false;
  return (
    settings.enabled &&
    Boolean(settings.apiKeyEncrypted) &&
    settings.receiptExtractionEnabled
  );
}
