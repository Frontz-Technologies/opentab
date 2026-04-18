"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { countryIntegrationCredentials } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  encrypt,
  decrypt,
} from "@/lib/country/providers/gr/integrations/mydata/encryption";
import { MyDataClient } from "@/lib/country/providers/gr/integrations/mydata/client";

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
    await db
      .update(countryIntegrationCredentials)
      .set({
        configJson,
        updatedAt: new Date(),
      })
      .where(eq(countryIntegrationCredentials.id, existing.id));
  } else {
    await db.insert(countryIntegrationCredentials).values({
      orgId: session.org.id,
      countryCode: GR,
      kind: MYDATA,
      configJson,
    });
  }

  revalidatePath("/settings/mydata");
  return { success: true };
}

export async function testMyDataConnection() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [cred] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(grMydataFilter(session.org.id));

  if (!cred) return { success: false, error: "No credentials found" };

  const cfg = cred.configJson as MydataCredConfig;

  try {
    const client = new MyDataClient({
      aadeUserId: cfg.aadeUserId,
      subscriptionKey: decrypt(cfg.subscriptionKey),
      environment: cfg.environment,
    });

    await client.sendInvoices([]);

    await db
      .update(countryIntegrationCredentials)
      .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(countryIntegrationCredentials.id, cred.id));

    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("401")) {
      return { success: false, error: "Invalid credentials" };
    }
    if (error instanceof Error && error.message.includes("403")) {
      return { success: false, error: "Access denied" };
    }

    await db
      .update(countryIntegrationCredentials)
      .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(countryIntegrationCredentials.id, cred.id));

    return { success: true };
  }
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
