"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { mydataCredentials } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { encrypt, decrypt } from "@/lib/mydata/encryption";
import { MyDataClient } from "@/lib/mydata/client";

const credentialsSchema = z.object({
  aadeUserId: z.string().min(1).max(100),
  subscriptionKey: z.string().min(1),
  environment: z.enum(["sandbox", "production"]),
});

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
    .from(mydataCredentials)
    .where(eq(mydataCredentials.orgId, session.org.id));

  if (existing) {
    await db
      .update(mydataCredentials)
      .set({
        aadeUserId,
        subscriptionKey: encryptedKey,
        environment,
        updatedAt: new Date(),
      })
      .where(eq(mydataCredentials.id, existing.id));
  } else {
    await db.insert(mydataCredentials).values({
      orgId: session.org.id,
      aadeUserId,
      subscriptionKey: encryptedKey,
      environment,
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
    .from(mydataCredentials)
    .where(eq(mydataCredentials.orgId, session.org.id));

  if (!cred) return { success: false, error: "No credentials found" };

  try {
    const client = new MyDataClient({
      aadeUserId: cred.aadeUserId,
      subscriptionKey: decrypt(cred.subscriptionKey),
      environment: cred.environment as "production" | "sandbox",
    });

    // Test with an empty request to verify credentials
    // AADE will return an error but not a 401 if credentials are valid
    await client.sendInvoices([]);

    await db
      .update(mydataCredentials)
      .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(mydataCredentials.id, cred.id));

    return { success: true };
  } catch (error) {
    // A 401/403 means bad credentials, anything else means credentials are OK
    if (error instanceof Error && error.message.includes("401")) {
      return { success: false, error: "Invalid credentials" };
    }
    if (error instanceof Error && error.message.includes("403")) {
      return { success: false, error: "Access denied" };
    }

    // Other errors (400, 500, etc.) mean credentials are valid but request was bad
    await db
      .update(mydataCredentials)
      .set({ lastValidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(mydataCredentials.id, cred.id));

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
    .delete(mydataCredentials)
    .where(eq(mydataCredentials.orgId, session.org.id));

  revalidatePath("/settings/mydata");
  return { success: true };
}

export async function getMyDataCredentialsStatus() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const [cred] = await db
    .select({
      id: mydataCredentials.id,
      aadeUserId: mydataCredentials.aadeUserId,
      environment: mydataCredentials.environment,
      isActive: mydataCredentials.isActive,
      lastValidatedAt: mydataCredentials.lastValidatedAt,
    })
    .from(mydataCredentials)
    .where(eq(mydataCredentials.orgId, session.org.id));

  return cred ?? null;
}
