"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  storeImportTempFile,
  getImportTempFile,
  deleteTempFile,
} from "@/lib/expenses/file-storage";
import { parseCsv } from "@/lib/import/core/parser";
import {
  contacts,
  expenses,
  invoices,
  invoiceItems,
  creditNotes,
  creditNoteItems,
} from "@opentab/db/schema";
import { recordActivity } from "@/lib/activities/record";
import { ACTIVITY_TYPE, ENTITY_TYPE } from "@/lib/entities/activity";
import { createLogger } from "@/lib/logging/logger";
import { getImporter } from "@/lib/import/importers";
import { runImport } from "@/lib/import/core/runner";
import { validateRows } from "@/lib/import/core/validator";
import {
  getAiColumnMatches,
  type AiSuggestion,
} from "@/lib/import/core/ai-match";
import { getAiSettingsSecret } from "@/lib/actions/ai-settings";
import { computeIdempotencyKey } from "@/lib/import/core/idempotency";
import { groupRowsByInvoice } from "@/lib/import/importers/invoices";
import { groupRowsByCreditNote } from "@/lib/import/importers/credit-notes";
import { calculateLineTotal } from "@/lib/invoicing/calculations";
import type { RowResult } from "@/lib/import/core/types";
import type { PgTable } from "drizzle-orm/pg-core";

const log = createLogger("import-actions");

interface CommitArgs {
  entityKey: string;
  importId: string;
  mapping: Record<string, string | null>;
  skippedByUser: number[];
  autoCreateToggles: Record<string, boolean>;
}

function ensureOwnerOrAdmin(role: string | undefined) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Forbidden");
  }
}

export interface ParsedSummary {
  importId: string;
  headers: string[];
  rowCount: number;
  sample: Record<string, string>[];
}

const SAMPLE_ROW_CAP = 50;

export async function uploadImportCsv(
  formData: FormData,
): Promise<{ ok: true; parsed: ParsedSummary } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  try {
    ensureOwnerOrAdmin(session.role);
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return { ok: false, error: "No file supplied" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalName = file instanceof File ? file.name : "import.csv";

  let parsed;
  try {
    parsed = await parseCsv(buffer);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse CSV",
    };
  }

  const importId = `tmp_${randomUUID()}`;
  await storeImportTempFile(session.org.id, importId, buffer, originalName);

  return {
    ok: true,
    parsed: {
      importId,
      headers: parsed.headers,
      rowCount: parsed.rows.length,
      sample: parsed.rows.slice(0, SAMPLE_ROW_CAP),
    },
  };
}

const TABLE_BY_ENTITY: Record<string, PgTable> = {
  contacts,
  expenses,
  invoices,
  "credit-notes": creditNotes,
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
        contactId: row.__contactId,
        // Empty-number rows import as DRAFT (v1.1, #220) — opentab
        // assigns the number on first publish via #132's deferred-
        // numbering pattern. Numbered rows import as SENT.
        status: row.invoiceNumber ? 2 : 1,
        invoiceNumber: row.invoiceNumber ?? null,
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
    case "credit-notes":
      return (row: Record<string, unknown>) => ({
        orgId,
        contactId: row.__contactId,
        invoiceId: row.__parentInvoiceId ?? null,
        // Same status rule as invoices: empty number → DRAFT, else
        // SENT (CREDIT_NOTE_STATUS.SENT = 3, DRAFT = 1).
        status: row.creditNoteNumber ? 3 : 1,
        creditNoteNumber: row.creditNoteNumber ?? null,
        issueDate: row.issueDate,
        currencyCode: row.currencyCode ?? "EUR",
        subtotal: row.total,
        taxAmount: "0.00",
        total: row.total,
        contactName: row.contactName,
        contactVatNumber: row.contactVatNumber ?? null,
        reason: row.reason,
        reasonNote: row.reasonNote ?? null,
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

  const storageKey = `${orgId}/imports/tmp/${args.importId}.csv`;

  let buffer: Buffer;
  try {
    buffer = await getImportTempFile(storageKey);
  } catch (err) {
    // Narrow to "file is genuinely missing" — TTL sweep, abandoned
    // wizard, idempotent double-commit. Anything else (S3 5xx, IAM
    // denial, network blip, malformed key) should propagate as a 500
    // so it surfaces in logs instead of being mislabelled as session
    // expiry.
    const code = (err as NodeJS.ErrnoException).code;
    const name = (err as { name?: string }).name;
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    const isMissing =
      code === "ENOENT" ||
      name === "NoSuchKey" ||
      name === "NotFound" ||
      status === 404 ||
      (err instanceof Error && /NoSuchKey|NotFound/i.test(err.message));
    if (!isMissing) throw err;
    return {
      created: 0,
      skippedDup: 0,
      skippedByUser: 0,
      failed: 0,
      errorCsv: null,
      ok: false as const,
      error: "Import session expired — please re-upload the file.",
    };
  }

  let parsed;
  try {
    parsed = await parseCsv(buffer);
  } catch (err) {
    return {
      created: 0,
      skippedDup: 0,
      skippedByUser: 0,
      failed: 0,
      errorCsv: null,
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to parse CSV",
    };
  }

  const validated = validateRows(parsed.rows, args.mapping, importer, orgId);

  // Invoice + credit-note rows need a real contactId (notNull at DB
  // level). Pre-resolve via a single batch lookup over distinct
  // contactNames; rows whose contact isn't found get demoted to
  // "blocked" so the batch insert doesn't trip the FK. For credit
  // notes we ALSO opportunistically link parent invoices by number
  // (link-only, never auto-create the parent — see spec #215).
  let resolved = validated;
  if (args.entityKey === "invoices" || args.entityKey === "credit-notes") {
    // autoCreateToggles.contact defaults to true (v1.1, #220) — most
    // imports want the auto-create-on-the-fly behaviour. Set to false
    // in the wizard for strict mode.
    const autoCreateContact = args.autoCreateToggles.contact !== false;
    resolved = await resolveInvoiceContactIds(
      orgId,
      resolved,
      autoCreateContact,
    );
  }
  if (args.entityKey === "credit-notes") {
    resolved = await linkParentInvoiceIds(orgId, resolved);
  }

  const result = await runImport({
    orgId,
    descriptor: importer,
    rows: resolved,
    skippedByUser: new Set(args.skippedByUser),
    table: TABLE_BY_ENTITY[args.entityKey],
    buildInsert: buildInsertForEntity(args.entityKey, orgId),
  });

  // Line-item insertion for invoices + credit notes (tester PR #219
  // High). The runner handles only the header rows; without this
  // post-pass, multi-row CSVs would land header-only because the
  // ON-CONFLICT-DO-NOTHING dedup on the header's idempotency key
  // swallows the second row before it can become a line item.
  if (args.entityKey === "invoices" || args.entityKey === "credit-notes") {
    await insertLineItemsForHeaderImport(args.entityKey, orgId, resolved);
  }

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
  // Delete only on the success path — if anything above this point
  // throws (line-item insert failure, recordActivity outage), the
  // raw CSV stays in storage so the user can retry. The TTL sweep
  // (cleanup-temp-files, 24h) catches files left behind by exceptions
  // that the user never retries.
  await deleteTempFile(storageKey);
  return { success: true, ...result };
}

// Idempotent cleanup of an in-flight import's temp CSV. Called by
// the wizard's React useEffect cleanup when the user navigates away
// without committing. The beacon-on-beforeunload counterpart lives
// at /api/import/cleanup (Server Actions can't accept the beacon
// POST shape). No role-guard — the key shape pins the operation to
// the caller's own org prefix, so the worst-case impact is a user
// re-cleaning their own already-cleaned-up file.
export async function cleanupImport(args: { importId: string }) {
  const session = await getSession();
  if (!session) return { ok: false };
  const key = `${session.org.id}/imports/tmp/${args.importId}.csv`;
  await deleteTempFile(key);
  return { ok: true };
}

// Batch contact-name → id lookup for invoice/credit-note imports.
//
//   1. Build the unique-name set from ok rows.
//   2. SELECT existing contacts in one query.
//   3. For names that didn't resolve:
//      - If autoCreate is true (v1.1, #220) → INSERT a stub contact
//        (displayName + vatNumber from the row, type=client, no
//        email/phone). Stub gets its own import_idempotency_key so
//        re-importing the same CSV reuses the auto-created contact
//        instead of creating a fresh one.
//      - If autoCreate is false → demote the row to "blocked" with
//        a clear "create the contact first" message (v1 behaviour).
async function resolveInvoiceContactIds(
  orgId: string,
  rows: RowResult<Record<string, unknown>>[],
  autoCreate: boolean,
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

  // Auto-create the missing ones. Use ON CONFLICT DO NOTHING on the
  // import_idempotency_key partial-unique index so a re-import of
  // the same CSV doesn't create duplicate stubs — the second run
  // just re-fetches the id below.
  if (autoCreate) {
    const missingNames = Array.from(distinctNames).filter(
      (n) => !nameToId.has(n),
    );
    if (missingNames.length > 0) {
      // Per-name idempotency key. Stable across imports of the same
      // displayName so the same stub is reused on re-import.
      const stubsToInsert = missingNames.map((name) => {
        // Find the first row carrying this contactName to grab vat
        // (if any) — best-effort enrichment, no-op if no vat in CSV.
        let vat: string | undefined;
        for (const r of rows) {
          if (r.kind === "blocked") continue;
          if (r.data.contactName === name) {
            vat = r.data.contactVatNumber as string | undefined;
            break;
          }
        }
        return {
          orgId,
          type: "client" as const,
          classification: "business" as const,
          displayName: name,
          vatNumber: vat ?? null,
          importIdempotencyKey: computeIdempotencyKey([
            orgId,
            "auto-contact",
            name.toLowerCase(),
          ]),
        };
      });
      await db.insert(contacts).values(stubsToInsert).onConflictDoNothing();
      // Re-query to pick up the auto-created ids (and any that lost
      // a race against another import — ON CONFLICT swallows them).
      const refound = await db
        .select({ id: contacts.id, displayName: contacts.displayName })
        .from(contacts)
        .where(
          and(
            eq(contacts.orgId, orgId),
            inArray(contacts.displayName, missingNames),
          ),
        );
      for (const c of refound) nameToId.set(c.displayName, c.id);
    }
  }

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
          `contactName: contact "${name ?? ""}" not found in this org. Toggle "Create missing contacts automatically" in the Map step, or create it via /import/contacts first.`,
        ],
      };
    }
    return {
      ...r,
      data: { ...r.data, __contactId: id },
    };
  });
}

// Opportunistic parent-invoice link by invoiceNumber. Per the spec
// #215, credit-note imports never AUTO-CREATE the parent — they
// just link if found. Rows whose `parentInvoiceNumber` is set but
// can't be resolved are kept (with __parentInvoiceId = undefined,
// so the column lands as NULL — standalone credit note).
async function linkParentInvoiceIds(
  orgId: string,
  rows: RowResult<Record<string, unknown>>[],
): Promise<RowResult<Record<string, unknown>>[]> {
  const distinctNumbers = new Set<string>();
  for (const r of rows) {
    if (r.kind === "blocked") continue;
    const num = r.data.parentInvoiceNumber as string | undefined;
    if (num) distinctNumbers.add(num);
  }
  if (distinctNumbers.size === 0) return rows;

  const found = await db
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        inArray(invoices.invoiceNumber, Array.from(distinctNumbers)),
      ),
    );
  const numToId = new Map(
    found
      .filter((i): i is { id: string; invoiceNumber: string } =>
        Boolean(i.invoiceNumber),
      )
      .map((i) => [i.invoiceNumber, i.id]),
  );

  return rows.map((r) => {
    if (r.kind === "blocked") return r;
    const num = r.data.parentInvoiceNumber as string | undefined;
    const id = num ? numToId.get(num) : undefined;
    return {
      ...r,
      data: { ...r.data, __parentInvoiceId: id },
    };
  });
}

// Inserts the line-item rows for invoice + credit-note imports.
// Called AFTER the header runImport step. Steps:
//   1. Group source rows by their natural key (invoiceNumber or
//      creditNoteNumber) — uses the descriptor-side helpers.
//   2. SELECT the header rows that landed (filtered by org + the
//      idempotency keys we sent in this run) so we can map
//      number → header id.
//   3. Bulk-INSERT one items row per source row, with line totals
//      computed via calculateLineTotal().
// On a re-import where every header row is a duplicate, every group
// finds no header id and the items insert is a no-op — same as the
// runner's ON-CONFLICT-DO-NOTHING contract for header rows.
async function insertLineItemsForHeaderImport(
  entityKey: "invoices" | "credit-notes",
  orgId: string,
  rows: RowResult<Record<string, unknown>>[],
): Promise<void> {
  const okRows = rows
    .filter(
      (
        r,
      ): r is
        | Extract<typeof r, { kind: "ok" }>
        | Extract<typeof r, { kind: "warning" }> =>
        r.kind === "ok" || r.kind === "warning",
    )
    .map((r) => r.data);

  if (okRows.length === 0) return;

  // Match headers by import_idempotency_key — works for both
  // numbered and empty-number rows (v1.1, #220), since the engine
  // sets the key on every insert. Compute the key inline using the
  // descriptor's idempotencyKeyParts fn so it matches what the
  // runner used.
  const importer = getImporter(entityKey);
  const keysByGroup = new Map<string, string>(); // group-natural-key → idempotency-key
  function keyForGroup(g: { header: Record<string, unknown> }): string {
    return computeIdempotencyKey(
      importer.idempotencyKeyParts(g.header as never, orgId),
    );
  }

  if (entityKey === "invoices") {
    const grouped = groupRowsByInvoice(
      okRows as unknown as Parameters<typeof groupRowsByInvoice>[0],
    );
    for (const g of grouped) {
      keysByGroup.set(
        g.header.invoiceNumber ?? `__group_${grouped.indexOf(g)}`,
        keyForGroup(g),
      );
    }
    const headerRows = await db
      .select({
        id: invoices.id,
        importIdempotencyKey: invoices.importIdempotencyKey,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.orgId, orgId),
          inArray(
            invoices.importIdempotencyKey,
            Array.from(keysByGroup.values()),
          ),
        ),
      );
    const keyToId = new Map(
      headerRows
        .filter((h): h is { id: string; importIdempotencyKey: string } =>
          Boolean(h.importIdempotencyKey),
        )
        .map((h) => [h.importIdempotencyKey, h.id]),
    );

    const itemRows: (typeof invoiceItems.$inferInsert)[] = [];
    for (const g of grouped) {
      const idempotencyKey = keyForGroup(g);
      const invoiceId = keyToId.get(idempotencyKey);
      if (!invoiceId) continue; // header was a duplicate / not landed
      let sortOrder = 0;
      for (const line of g.lines) {
        const totals = calculateLineTotal({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          usesInclusiveTax: false,
        });
        itemRows.push({
          invoiceId,
          sortOrder: sortOrder++,
          name: line.itemName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          unit: line.unit ?? null,
          taxCategory: "standard",
          taxRate: line.taxRate,
          taxAmount: totals.taxAmount,
          lineTotal: totals.lineTotal,
        });
      }
    }
    if (itemRows.length > 0) {
      await db.insert(invoiceItems).values(itemRows);
    }
    return;
  }

  // entityKey === "credit-notes"
  const grouped = groupRowsByCreditNote(
    okRows as unknown as Parameters<typeof groupRowsByCreditNote>[0],
  );
  for (const g of grouped) {
    keysByGroup.set(
      g.header.creditNoteNumber ?? `__group_${grouped.indexOf(g)}`,
      keyForGroup(g),
    );
  }
  const headerRows = await db
    .select({
      id: creditNotes.id,
      importIdempotencyKey: creditNotes.importIdempotencyKey,
    })
    .from(creditNotes)
    .where(
      and(
        eq(creditNotes.orgId, orgId),
        inArray(
          creditNotes.importIdempotencyKey,
          Array.from(keysByGroup.values()),
        ),
      ),
    );
  const keyToId = new Map(
    headerRows
      .filter((h): h is { id: string; importIdempotencyKey: string } =>
        Boolean(h.importIdempotencyKey),
      )
      .map((h) => [h.importIdempotencyKey, h.id]),
  );

  const itemRows: (typeof creditNoteItems.$inferInsert)[] = [];
  for (const g of grouped) {
    const idempotencyKey = keyForGroup(g);
    const creditNoteId = keyToId.get(idempotencyKey);
    if (!creditNoteId) continue;
    let sortOrder = 0;
    for (const line of g.lines) {
      const totals = calculateLineTotal({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        usesInclusiveTax: false,
      });
      itemRows.push({
        creditNoteId,
        sortOrder: sortOrder++,
        name: line.itemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unit: line.unit ?? null,
        taxCategory: "standard",
        taxRate: line.taxRate,
        taxAmount: totals.taxAmount,
        lineTotal: totals.lineTotal,
      });
    }
  }
  if (itemRows.length > 0) {
    await db.insert(creditNoteItems).values(itemRows);
  }
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

export interface AiSuggestionsInput {
  unmappedHeaders: string[];
  // Pre-trimmed by the client via `buildSamplesByHeader` from
  // `lib/import/core/ai-match.ts`. Sending only samples (≤ 3 × 32
  // chars per header) keeps the RSC payload bounded for large CSVs.
  samplesByHeader: Record<string, string[]>;
}

export async function getAiSuggestions(
  entityKey: string,
  input: AiSuggestionsInput,
): Promise<AiSuggestion[]> {
  const session = await getSession();
  if (!session) return [];
  if (session.role !== "owner" && session.role !== "admin") return [];

  const importer = getImporter(entityKey);
  if (!importer) return [];

  const aiSecrets = await getAiSettingsSecret(session.org.id, "extraction");
  if (!aiSecrets?.apiKey) return [];

  return getAiColumnMatches({
    apiKey: aiSecrets.apiKey,
    model: aiSecrets.model,
    entityKey,
    fields: importer.fields.map((f) => ({
      name: f.name,
      required: f.required,
    })),
    unmappedHeaders: input.unmappedHeaders,
    samplesByHeader: input.samplesByHeader,
  });
}
