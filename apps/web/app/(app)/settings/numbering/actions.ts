"use server";

import { revalidatePath } from "next/cache";
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

  // Mirrors the owner|admin gate every other Organisation-section
  // action enforces (settings/organisation, settings/integrations/*).
  // Invoice numbering changes the org-wide prefix/pattern that drives
  // every future invoice number — finance/audit-trail concern, not
  // cosmetic — so member/accountant must not be able to call this.
  if (session.role !== "owner" && session.role !== "admin") {
    throw new Error("Forbidden");
  }

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

  const data = parsed.data;
  // Single upsert against the unique (orgId, type) index — replaces the
  // SELECT-then-INSERT-or-UPDATE pattern that lost a race when two
  // first-time saves on a fresh org both took the INSERT branch.
  await db
    .insert(invoiceSequences)
    .values({
      orgId,
      type: "invoice",
      prefix: data.prefix,
      digitCount: data.digitCount,
      includeYear: data.includeYear,
      pattern: data.pattern,
      // nextNumber defaults to 1 in the schema.
    })
    .onConflictDoUpdate({
      target: [invoiceSequences.orgId, invoiceSequences.type],
      set: {
        prefix: data.prefix,
        digitCount: data.digitCount,
        includeYear: data.includeYear,
        pattern: data.pattern,
      },
    });

  log.info("invoice numbering updated", {
    orgId,
    prefix: data.prefix,
    pattern: data.pattern,
  });

  revalidatePath("/settings/numbering");
  return { success: true };
}
