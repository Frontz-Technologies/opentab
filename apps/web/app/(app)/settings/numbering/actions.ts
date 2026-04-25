"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  invoiceSequences,
  updateInvoiceNumberingSchema,
} from "@/lib/entities/invoice-sequence";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("invoice-numbering");

export async function updateInvoiceNumbering(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;

  const parsed = updateInvoiceNumberingSchema.safeParse({
    prefix: formData.get("prefix"),
    digitCount: formData.get("digitCount"),
    includeYear: formData.get("includeYear") === "true",
    pattern: formData.get("pattern") ?? "",
  });

  if (!parsed.success) {
    log.warn("invoice numbering validation failed", {
      orgId,
      errors: parsed.error.flatten().fieldErrors,
    });
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  // Ensure a sequence row exists for "invoice" — first-time
  // configuration on a fresh org has no row yet.
  const [existing] = await db
    .select()
    .from(invoiceSequences)
    .where(
      and(
        eq(invoiceSequences.orgId, orgId),
        eq(invoiceSequences.type, "invoice"),
      ),
    );

  const data = parsed.data;
  if (existing) {
    await db
      .update(invoiceSequences)
      .set({
        prefix: data.prefix,
        digitCount: data.digitCount,
        includeYear: data.includeYear,
        pattern: data.pattern,
      })
      .where(eq(invoiceSequences.id, existing.id));
  } else {
    await db.insert(invoiceSequences).values({
      orgId,
      type: "invoice",
      prefix: data.prefix,
      digitCount: data.digitCount,
      includeYear: data.includeYear,
      pattern: data.pattern,
      // nextNumber defaults to 1 in the schema.
    });
  }

  log.info("invoice numbering updated", {
    orgId,
    prefix: data.prefix,
    pattern: data.pattern,
  });

  revalidatePath("/settings/numbering");
  return { success: true };
}
