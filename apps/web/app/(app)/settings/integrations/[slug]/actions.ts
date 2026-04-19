"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { countryIntegrationCredentials } from "@opentab/db/schema";
import { getCountryProvider } from "@/lib/country";
import type { Integration } from "@/lib/country/types";
import { encryptConfig, decryptConfig } from "@/lib/country/crypto";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("country-integration-credentials");

function findIntegrationBySlug(
  countryCode: string | null,
  slug: string,
): { integration: Integration; countryCode: string } | null {
  const provider = getCountryProvider(countryCode);
  const integration = provider.integrations.find(
    (i) => i.settingsPage?.slug === slug || i.kind === slug,
  );
  if (!integration) return null;
  return { integration, countryCode: provider.code };
}

function assertRole(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Forbidden");
  }
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    out[k] = typeof v === "string" ? v : v;
  }
  return out;
}

export async function saveIntegrationCredentials(
  slug: string,
  formData: FormData,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  assertRole(session.role);

  const match = findIntegrationBySlug(session.org.countryCode, slug);
  if (!match) {
    return { success: false, error: "Integration not found" };
  }
  const { integration, countryCode } = match;

  if (!integration.configSchema) {
    return {
      success: false,
      error: "Integration does not declare a configSchema",
    };
  }

  const raw = formDataToObject(formData);
  const parsed = integration.configSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  const encrypted = encryptConfig(
    parsed.data as Record<string, unknown>,
    integration.publicFields ?? [],
  );

  const [existing] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(
      and(
        eq(countryIntegrationCredentials.orgId, session.org.id),
        eq(countryIntegrationCredentials.countryCode, countryCode),
        eq(countryIntegrationCredentials.kind, integration.kind),
      ),
    );

  if (existing) {
    await db
      .update(countryIntegrationCredentials)
      .set({
        configJson: encrypted,
        isActive: true,
        lastValidatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(countryIntegrationCredentials.id, existing.id));
    log.info("credentials updated", {
      orgId: session.org.id,
      countryCode,
      kind: integration.kind,
    });
  } else {
    await db.insert(countryIntegrationCredentials).values({
      orgId: session.org.id,
      countryCode,
      kind: integration.kind,
      configJson: encrypted,
      isActive: true,
    });
    log.info("credentials created", {
      orgId: session.org.id,
      countryCode,
      kind: integration.kind,
    });
  }

  revalidatePath(`/settings/integrations/${slug}`);
  return { success: true };
}

export async function testIntegrationConnection(slug: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const match = findIntegrationBySlug(session.org.countryCode, slug);
  if (!match) return { success: false, error: "Integration not found" };
  const { integration, countryCode } = match;

  if (!integration.validateCredentials) {
    return { success: true };
  }

  const [cred] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(
      and(
        eq(countryIntegrationCredentials.orgId, session.org.id),
        eq(countryIntegrationCredentials.countryCode, countryCode),
        eq(countryIntegrationCredentials.kind, integration.kind),
      ),
    );

  if (!cred) return { success: false, error: "No credentials found" };

  const decrypted = decryptConfig(
    cred.configJson as Record<string, unknown>,
    integration.publicFields ?? [],
  );

  const done = log.time("test-connection");
  const result = await integration.validateCredentials(decrypted, {
    orgId: session.org.id,
  });
  done("test-connection finished", {
    orgId: session.org.id,
    countryCode,
    kind: integration.kind,
    ok: result.ok,
  });

  if (result.ok) {
    await db
      .update(countryIntegrationCredentials)
      .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(countryIntegrationCredentials.id, cred.id));
    return { success: true };
  }

  return {
    success: false,
    error: result.errors?.join("; ") ?? "Validation failed",
  };
}

export async function deleteIntegrationCredentials(slug: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  assertRole(session.role);

  const match = findIntegrationBySlug(session.org.countryCode, slug);
  if (!match) return { success: false, error: "Integration not found" };
  const { integration, countryCode } = match;

  await db
    .delete(countryIntegrationCredentials)
    .where(
      and(
        eq(countryIntegrationCredentials.orgId, session.org.id),
        eq(countryIntegrationCredentials.countryCode, countryCode),
        eq(countryIntegrationCredentials.kind, integration.kind),
      ),
    );

  log.info("credentials deleted", {
    orgId: session.org.id,
    countryCode,
    kind: integration.kind,
  });

  revalidatePath(`/settings/integrations/${slug}`);
  return { success: true };
}
