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

const log = createLogger("ai-settings");

const updateAiSettingsSchema = z.object({
  enabled: z.boolean(),
  model: z.string().min(1).max(100),
  apiKey: z.string().trim().optional().default(""),
  receiptExtractionEnabled: z.boolean().default(true),
});

export type AiSettingsPublic = {
  enabled: boolean;
  model: string;
  apiKeyLast4: string | null;
  hasApiKey: boolean;
  receiptExtractionEnabled: boolean;
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
    model: settings.model,
    apiKeyLast4: settings.apiKeyLast4 ?? null,
    hasApiKey: Boolean(settings.apiKeyEncrypted),
    receiptExtractionEnabled: settings.receiptExtractionEnabled,
  };
}

export async function getAiEnvConfig(): Promise<{
  model: string;
  apiKeyLast4: string;
} | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return {
    model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5",
    apiKeyLast4: apiKey.slice(-4),
  };
}

export async function getAiSettingsSecret(orgId: string) {
  // Env vars take priority over DB settings
  const envApiKey = process.env.OPENROUTER_API_KEY;
  const envModel =
    process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";
  if (envApiKey) {
    return { enabled: true, model: envModel, apiKey: envApiKey };
  }

  const settings = await getAiSettingsRow(orgId);
  if (!settings || !settings.apiKeyEncrypted || !settings.apiKeyIv) {
    return null;
  }

  return {
    enabled: settings.enabled,
    model: settings.model,
    apiKey: decryptApiKey(settings.apiKeyEncrypted, settings.apiKeyIv),
  };
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

  let encryptedKey: ReturnType<typeof encryptApiKey> | null = null;
  if (next.apiKey) {
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

  if (existing) {
    await db
      .update(aiSettings)
      .set({
        enabled: next.enabled,
        model: next.model,
        receiptExtractionEnabled: next.receiptExtractionEnabled,
        apiKeyEncrypted: encryptedKey?.encrypted ?? existing.apiKeyEncrypted,
        apiKeyIv: encryptedKey?.iv ?? existing.apiKeyIv,
        apiKeyLast4: encryptedKey?.last4 ?? existing.apiKeyLast4,
        updatedAt: new Date(),
      })
      .where(eq(aiSettings.id, existing.id));
  } else {
    await db.insert(aiSettings).values({
      orgId,
      enabled: next.enabled,
      model: next.model,
      receiptExtractionEnabled: next.receiptExtractionEnabled,
      apiKeyEncrypted: encryptedKey?.encrypted ?? null,
      apiKeyIv: encryptedKey?.iv ?? null,
      apiKeyLast4: encryptedKey?.last4 ?? null,
    });
  }

  log.info("AI settings updated", {
    orgId,
    enabled: next.enabled,
    model: next.model,
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

  const settings = await getAiSettingsSecret(orgId);
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
  // Env var config enables extraction automatically
  if (process.env.OPENROUTER_API_KEY) return true;

  const settings = await getAiSettingsRow(orgId);
  if (!settings) return false;
  return (
    settings.enabled &&
    Boolean(settings.apiKeyEncrypted) &&
    settings.receiptExtractionEnabled
  );
}
