import { createLogger } from "@/lib/logging/logger";
import { db as prodDb } from "@/lib/db";
import type { PgTable } from "drizzle-orm/pg-core";
import type { ImporterDescriptor, ImportRunResult, RowResult } from "./types";

const log = createLogger("import:runner");

const BATCH_SIZE = 100;

export type DbInstance = typeof prodDb;

export interface RunImportArgs<T extends Record<string, unknown>> {
  orgId: string;
  descriptor: ImporterDescriptor<T>;
  rows: RowResult<T>[];
  skippedByUser: Set<number>;
  // Drizzle table for the entity. Engine appends importIdempotencyKey
  // and applies ON CONFLICT DO NOTHING against the partial unique
  // (org_id, import_idempotency_key) WHERE import_idempotency_key IS NOT NULL.
  table: PgTable;
  // Builds the column-shape insert payload for one row. Engine adds
  // importIdempotencyKey on top automatically.
  buildInsert(row: T): Record<string, unknown>;
  dbInstance?: DbInstance;
}

export async function runImport<T extends Record<string, unknown>>(
  args: RunImportArgs<T>,
): Promise<ImportRunResult> {
  const { orgId, rows, skippedByUser, table, buildInsert } = args;
  const db = args.dbInstance ?? prodDb;

  let created = 0;
  let skippedDup = 0;
  let skippedByUserCount = 0;
  let failed = 0;
  const errors: {
    rowNumber: number;
    messages: string[];
    raw: Record<string, string>;
  }[] = [];

  // Partition: ok+warning go into the insert batch; blocked → error
  // CSV; skippedByUser is taken out of "ok" by row number.
  const insertable: { row: T; idempotencyKey: string }[] = [];
  for (const r of rows) {
    if (r.kind === "blocked") {
      errors.push({
        rowNumber: r.rowNumber,
        messages: r.messages,
        raw: r.raw,
      });
      failed++;
      continue;
    }
    if (skippedByUser.has(r.rowNumber)) {
      skippedByUserCount++;
      continue;
    }
    insertable.push({ row: r.data, idempotencyKey: r.idempotencyKey });
  }

  for (let i = 0; i < insertable.length; i += BATCH_SIZE) {
    const batch = insertable.slice(i, i + BATCH_SIZE);
    const values = batch.map((b) => ({
      ...buildInsert(b.row),
      importIdempotencyKey: b.idempotencyKey,
    }));
    // Drizzle's onConflictDoNothing() with no target uses the
    // table's available unique constraints — the partial unique on
    // (orgId, importIdempotencyKey) catches duplicates from prior
    // runs. The `returning()` count tells us how many actually
    // landed; the difference is the dedup count.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = (await (db as any)
      .insert(table)
      .values(values)
      .onConflictDoNothing()
      .returning()) as unknown[];
    created += inserted.length;
    skippedDup += values.length - inserted.length;
  }

  const errorCsv = errors.length > 0 ? buildErrorCsv(errors) : null;

  log.info("import run completed", {
    orgId,
    created,
    skippedDup,
    skippedByUser: skippedByUserCount,
    failed,
  });

  return {
    created,
    skippedDup,
    skippedByUser: skippedByUserCount,
    failed,
    errorCsv,
  };
}

// CSV-injection guard (OWASP) — same shape as the lib/activities/csv.ts
// fix from PR #211. Excel / Numbers / Sheets interpret a field whose
// first character is one of `= + - @ \t \r` as a formula on import
// (e.g. `=cmd|/c calc!A0`). Error CSV cells echo the user's own input
// straight back, so a hostile or accidentally-malformed value would
// otherwise execute on open. Prefix such fields with a single
// apostrophe — the apostrophe is consumed by the spreadsheet parser
// as a string-literal marker and doesn't appear in the rendered cell.
function csvEscape(s: string): string {
  let v = s;
  if (v.length > 0 && /^[=+\-@\t\r]/.test(v)) {
    v = "'" + v;
  }
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function buildErrorCsv(
  errors: {
    rowNumber: number;
    messages: string[];
    raw: Record<string, string>;
  }[],
): string {
  const allHeaders = new Set<string>();
  for (const e of errors) for (const k of Object.keys(e.raw)) allHeaders.add(k);
  const headers = ["row_number", "errors", ...Array.from(allHeaders)];
  const lines = [headers.join(",")];
  for (const e of errors) {
    const cells = [
      String(e.rowNumber),
      csvEscape(e.messages.join("; ")),
      ...Array.from(allHeaders).map((h) => csvEscape(e.raw[h] ?? "")),
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\r\n");
}
