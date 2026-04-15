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

export async function getAiSettingsSecret(orgId: string) {
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

  const parsed = updateAiSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const existing = await getAiSettingsRow(session.org.id);
  const next = parsed.data;

  let encryptedKey: ReturnType<typeof encryptApiKey> | null = null;
  if (next.apiKey) {
    try {
      encryptedKey = encryptApiKey(next.apiKey);
    } catch {
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
      orgId: session.org.id,
      enabled: next.enabled,
      model: next.model,
      receiptExtractionEnabled: next.receiptExtractionEnabled,
      apiKeyEncrypted: encryptedKey?.encrypted ?? null,
      apiKeyIv: encryptedKey?.iv ?? null,
      apiKeyLast4: encryptedKey?.last4 ?? null,
    });
  }

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

  try {
    const model = createAiProvider(settings.apiKey, settings.model);
    await generateText({
      model,
      prompt: "Hi",
      maxTokens: 5,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

export async function isReceiptExtractionEnabled(
  orgId: string,
): Promise<boolean> {
  const settings = await getAiSettingsRow(orgId);
  if (!settings) return false;
  return (
    settings.enabled &&
    Boolean(settings.apiKeyEncrypted) &&
    settings.receiptExtractionEnabled
  );
}
