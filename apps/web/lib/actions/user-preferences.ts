"use server";

import { eq } from "drizzle-orm";
import { userPreferences } from "@opentab/db/schema";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function getUserPreferences() {
  const session = await getSession();
  if (!session) return null;

  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id));

  return prefs ?? null;
}

export async function upsertUserPreferences(
  data: Partial<{
    locale: string;
    dateFormat: string;
    numberFormat: string;
    notifyInvoicePaid: boolean;
    notifyExpenseApproved: boolean;
    theme: string;
    density: string;
  }>,
) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id));

  if (existing) {
    const [updated] = await db
      .update(userPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userPreferences.userId, session.user.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(userPreferences)
    .values({ userId: session.user.id, ...data })
    .returning();
  return created;
}
