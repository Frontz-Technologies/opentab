"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { countryIntegrationCredentials } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { encrypt } from "@/lib/country/providers/gr/integrations/mydata/encryption";
import { MydataIntegration } from "@/lib/country/providers/gr/integrations/mydata";
import { createLogger } from "@/lib/logging/logger";
import { throttleTestConnection } from "@/lib/country/test-connection-throttle";

const log = createLogger("country-integration-credentials");

const GR = "GR";
const MYDATA = "mydata";

interface MydataCredConfig {
  aadeUserId: string;
  subscriptionKey: string;
  environment: "production" | "sandbox";
}

const credentialsSchema = z.object({
  aadeUserId: z.string().min(1).max(100),
  subscriptionKey: z.string().min(1),
  environment: z.enum(["sandbox", "production"]),
});

function grMydataFilter(orgId: string) {
  return and(
    eq(countryIntegrationCredentials.orgId, orgId),
    eq(countryIntegrationCredentials.countryCode, GR),
    eq(countryIntegrationCredentials.kind, MYDATA),
  );
}

export async function saveMyDataCredentials(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (session.role !== "owner" && session.role !== "admin") {
    throw new Error("Forbidden");
  }

  const parsed = credentialsSchema.safeParse({
    aadeUserId: formData.get("aadeUserId"),
    subscriptionKey: formData.get("subscriptionKey"),
    environment: formData.get("environment"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const { aadeUserId, subscriptionKey, environment } = parsed.data;
  const encryptedKey = encrypt(subscriptionKey);

  const [existing] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(grMydataFilter(session.org.id));

  const configJson: MydataCredConfig = {
    aadeUserId,
    subscriptionKey: encryptedKey,
    environment,
  };

  if (existing) {
    // #274 defence-in-depth: pair the id check with orgId so every
    // mutation carries the org scope, not just the preceding SELECT.
    await db
      .update(countryIntegrationCredentials)
      .set({
        configJson,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(countryIntegrationCredentials.id, existing.id),
          eq(countryIntegrationCredentials.orgId, session.org.id),
        ),
      );
    log.info("credentials updated", {
      orgId: session.org.id,
      kind: MYDATA,
      environment,
    });
  } else {
    await db.insert(countryIntegrationCredentials).values({
      orgId: session.org.id,
      countryCode: GR,
      kind: MYDATA,
      configJson,
    });
    log.info("credentials created", {
      orgId: session.org.id,
      kind: MYDATA,
      environment,
    });
  }

  revalidatePath("/settings/mydata");
  return { success: true };
}

export async function testMyDataConnection() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (session.role !== "owner" && session.role !== "admin") {
    throw new Error("Forbidden");
  }

  const [cred] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(grMydataFilter(session.org.id));

  if (!cred) {
    log.warn("test-connection: no credentials found", {
      orgId: session.org.id,
      kind: MYDATA,
    });
    return { success: false, error: "No credentials found" };
  }

  const throttleError = throttleTestConnection(cred.lastValidatedAt);
  if (throttleError) return { success: false, error: throttleError };

  const done = log.time("test-connection");
  const result = await MydataIntegration.validateCredentials!(
    cred.configJson as Record<string, unknown>,
    { orgId: session.org.id },
  );
  done("test-connection finished", {
    orgId: session.org.id,
    kind: MYDATA,
    ok: result.ok,
  });

  if (result.ok) {
    // #274 defence-in-depth: scope the lastValidatedAt update by orgId
    // even though `cred` was just selected with orgId already.
    await db
      .update(countryIntegrationCredentials)
      .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(countryIntegrationCredentials.id, cred.id),
          eq(countryIntegrationCredentials.orgId, session.org.id),
        ),
      );
    return { success: true };
  }

  return {
    success: false,
    error: result.errors?.join("; ") ?? "Validation failed",
  };
}

export async function deleteMyDataCredentials() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (session.role !== "owner" && session.role !== "admin") {
    throw new Error("Forbidden");
  }

  await db
    .delete(countryIntegrationCredentials)
    .where(grMydataFilter(session.org.id));

  log.info("credentials deleted", { orgId: session.org.id, kind: MYDATA });

  revalidatePath("/settings/mydata");
  return { success: true };
}

export async function getMyDataCredentialsStatus() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [cred] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(grMydataFilter(session.org.id));

  if (!cred) return null;

  const cfg = cred.configJson as MydataCredConfig;

  return {
    id: cred.id,
    aadeUserId: cfg.aadeUserId,
    environment: cfg.environment,
    isActive: cred.isActive,
    lastValidatedAt: cred.lastValidatedAt,
  };
}
