import type { ZodSchema } from "zod";
import type { AliasMap } from "./alias-table";

// Per-row outcome from validator.ts. `kind: "blocked"` skips the
// commit; `kind: "warning"` commits with the warning visible in the
// preview UI; `kind: "ok"` is a clean row.
export type RowResult<T> =
  | { kind: "ok"; rowNumber: number; data: T; idempotencyKey: string }
  | {
      kind: "warning";
      rowNumber: number;
      data: T;
      idempotencyKey: string;
      messages: string[];
    }
  | {
      kind: "blocked";
      rowNumber: number;
      raw: Record<string, string>;
      messages: string[];
    };

export interface ImportRunResult {
  created: number;
  skippedDup: number;
  skippedByUser: number;
  failed: number;
  errorCsv: string | null; // populated only when failed > 0
}

// Per-entity descriptor. Each importer file under
// `lib/import/importers/<name>.ts` exports one of these.
export interface ImporterDescriptor<T extends Record<string, unknown>> {
  // Stable key used in the URL: /import/<entityKey>.
  entityKey: string;
  // Human label for the wizard heading and the entity-list "Import"
  // button (driven by the i18n key, this is the fallback).
  label: string;
  // Field names we accept from a CSV. Used by the mapper + the
  // sample-CSV download. Order is the sample-CSV column order.
  fields: Array<{
    name: string;
    required: boolean;
    type: "string" | "number" | "date" | "uuid" | "enum";
    enum?: readonly string[];
  }>;
  aliases: AliasMap;
  // Per-row Zod schema. Unmapped optional fields default to null/empty
  // before parsing — handled in validator.ts.
  rowSchema: ZodSchema<T>;
  // Returns a stable hash key tuple. Engine SHA-256s the joined string.
  idempotencyKeyParts(row: T, orgId: string): string[];
}

// State held by the React wizard between Map and Preview/Commit.
export interface WizardState {
  parsed: { headers: string[]; rows: Record<string, string>[] } | null;
  mapping: Record<string, string | null>;
  autoCreateToggles: Record<string, boolean>;
  validatedRows: RowResult<Record<string, unknown>>[];
  skippedByUser: Set<number>; // rowNumber set
  result: ImportRunResult | null;
}
