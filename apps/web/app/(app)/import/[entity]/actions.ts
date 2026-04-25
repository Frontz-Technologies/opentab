"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { contacts, expenses, invoices } from "@opentab/db/schema";
import { recordActivity } from "@/lib/activities/record";
import { ACTIVITY_TYPE, ENTITY_TYPE } from "@/lib/entities/activity";
import { createLogger } from "@/lib/logging/logger";
import { getImporter } from "@/lib/import/importers";
import { runImport } from "@/lib/import/core/runner";
import { validateRows } from "@/lib/import/core/validator";
import type { RowResult } from "@/lib/import/core/types";
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
        // randomUUID() — collision-safe (~122 bits of entropy) so a
        // 5000-row batch can't trip the unique (org_id, expense_number)
        // index that the prior Date.now() + 5-char base36 default
        // could (tester PR #218 Medium #2).
        expenseNumber: row.expenseNumber ?? `IMPORT-${randomUUID()}`,
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

  // Invoice rows need a real contactId (notNull at DB level). Pre-
  // resolve via a single batch lookup over distinct contactNames;
  // rows whose contact isn't found get demoted to "blocked" so the
  // batch insert doesn't trip the FK. Auto-create-missing-contact
  // is the v1.1 follow-up.
  const resolved =
    args.entityKey === "invoices"
      ? await resolveInvoiceContactIds(orgId, validated)
      : validated;

  const result = await runImport({
    orgId,
    descriptor: importer,
    rows: resolved,
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

// Batch contact-name → id lookup for invoice imports. Walks the ok
// rows once, builds a unique-name set, runs a single SELECT, then
// either attaches __contactId to each row's data or demotes the row
// to "blocked" with a clear "contact not found" message. Auto-create-
// missing-contact behavior is the v1.1 follow-up — for v1 we require
// the contact to already exist (matches the spec's PR-A scope).
async function resolveInvoiceContactIds(
  orgId: string,
  rows: RowResult<Record<string, unknown>>[],
): Promise<RowResult<Record<string, unknown>>[]> {
  const distinctNames = new Set<string>();
  for (const r of rows) {
    if (r.kind === "blocked") continue;
    const name = r.data.contactName as string | undefined;
    if (name) distinctNames.add(name);
  }
  if (distinctNames.size === 0) return rows;

  const found = await db
    .select({ id: contacts.id, displayName: contacts.displayName })
    .from(contacts)
    .where(
      and(
        eq(contacts.orgId, orgId),
        inArray(contacts.displayName, Array.from(distinctNames)),
      ),
    );
  const nameToId = new Map(found.map((c) => [c.displayName, c.id]));

  return rows.map((r) => {
    if (r.kind === "blocked") return r;
    const name = r.data.contactName as string | undefined;
    const id = name ? nameToId.get(name) : undefined;
    if (!id) {
      return {
        kind: "blocked",
        rowNumber: r.rowNumber,
        raw: { contactName: name ?? "" },
        messages: [
          `contactName: contact "${name ?? ""}" not found in this org. Create it via /import/contacts first, then re-run.`,
        ],
      };
    }
    return {
      ...r,
      data: { ...r.data, __contactId: id },
    };
  });
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
