"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { contacts, expenses, invoices } from "@opentab/db/schema";
import { recordActivity } from "@/lib/activities/record";
import { ACTIVITY_TYPE, ENTITY_TYPE } from "@/lib/entities/activity";
import { createLogger } from "@/lib/logging/logger";
import { getImporter } from "@/lib/import/importers";
import { runImport } from "@/lib/import/core/runner";
import { validateRows } from "@/lib/import/core/validator";
import type { PgTable } from "drizzle-orm/pg-core";

const log = createLogger("import-actions");

interface CommitArgs {
  entityKey: string;
  rows: Record<string, string>[];
  mapping: Record<string, string | null>;
  skippedByUser: number[];
  autoCreateToggles: Record<string, boolean>;
}

function ensureOwnerOrAdmin(role: string | undefined) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Forbidden");
  }
}

const TABLE_BY_ENTITY: Record<string, PgTable> = {
  contacts,
  expenses,
  invoices,
};

function buildInsertForEntity(entityKey: string, orgId: string) {
  switch (entityKey) {
    case "contacts":
      return (row: Record<string, unknown>) => ({
        orgId,
        type: row.type ?? "client",
        classification: row.classification ?? "business",
        company: row.company ?? null,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        displayName: row.displayName,
        email: row.email ?? null,
        phone: row.phone ?? null,
        vatNumber: row.vatNumber ?? null,
        countryCode: row.countryCode ?? null,
        addressLine1: row.addressLine1 ?? null,
        city: row.city ?? null,
        postalCode: row.postalCode ?? null,
        defaultPaymentTerms: row.defaultPaymentTerms ?? 30,
      });
    case "expenses":
      return (row: Record<string, unknown>) => ({
        orgId,
        expenseDate: row.expenseDate,
        paymentDate: row.paymentDate ?? null,
        currencyCode: row.currencyCode ?? "EUR",
        subtotal: row.subtotal ?? row.total,
        taxAmount: row.taxAmount ?? "0.00",
        total: row.total,
        contactName: row.supplierName ?? null,
        contactVatNumber: row.supplierVat ?? null,
        expenseNumber:
          row.expenseNumber ??
          `IMPORT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        source: "import",
        description: row.notes ?? null,
      });
    case "invoices":
      return (row: Record<string, unknown>) => ({
        orgId,
        // contactId is auto-resolved in v1.1 (auto-create-missing-refs).
        // For now, the import requires the contact already to exist;
        // descriptor's contactName drives buildInsert by lookup but
        // we don't have that wiring yet — emit null to satisfy the
        // notNull contactId constraint by falling back to a stub
        // resolution path. v1.1 task implements proper lookup.
        contactId: row.__contactId ?? null,
        status: 2, // SENT — published+sent for imports
        invoiceNumber: row.invoiceNumber,
        issueDate: row.issueDate,
        dueDate: row.dueDate ?? null,
        currencyCode: row.currencyCode ?? "EUR",
        subtotal: row.total,
        taxAmount: "0.00",
        total: row.total,
        balance: row.total,
        contactName: row.contactName,
        contactVatNumber: row.contactVatNumber ?? null,
      });
    default:
      throw new Error(`unknown entity: ${entityKey}`);
  }
}

export async function commitImport(args: CommitArgs) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  ensureOwnerOrAdmin(session.role);

  const orgId = session.org.id;
  const importer = getImporter(args.entityKey);
  const validated = validateRows(args.rows, args.mapping, importer, orgId);

  const result = await runImport({
    orgId,
    descriptor: importer,
    rows: validated,
    skippedByUser: new Set(args.skippedByUser),
    table: TABLE_BY_ENTITY[args.entityKey],
    buildInsert: buildInsertForEntity(args.entityKey, orgId),
  });

  await recordActivity({
    orgId,
    entityType: ENTITY_TYPE.IMPORT,
    entityId: orgId,
    userId: session.user.id,
    type: ACTIVITY_TYPE.IMPORT_RUN_COMPLETED,
    payload: {
      entity: args.entityKey,
      created: result.created,
      skippedDup: result.skippedDup,
      skippedByUser: result.skippedByUser,
      failed: result.failed,
    },
  });

  log.info("import committed", {
    orgId,
    entityKey: args.entityKey,
    ...result,
  });

  revalidatePath(`/${args.entityKey}`);
  return { success: true, ...result };
}

// Server-rendered sample CSV — header row only, derived from the
// descriptor's fields list. Required fields come first.
export async function getSampleCsv(entityKey: string): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  ensureOwnerOrAdmin(session.role);

  const importer = getImporter(entityKey);
  const required = importer.fields.filter((f) => f.required).map((f) => f.name);
  const optional = importer.fields
    .filter((f) => !f.required)
    .map((f) => f.name);
  return [...required, ...optional].join(",") + "\n";
}
