import type { ImporterDescriptor, RowResult } from "./types";
import { computeIdempotencyKey } from "./idempotency";

// For each parsed row:
//   1. Project the raw row through the user's mapping (header →
//      canonical field). Skipped columns drop out.
//   2. Zod-parse against the descriptor's rowSchema.
//   3. On success, compute the idempotency key; emit "ok".
//   4. On failure, emit "blocked" with the field-level messages.
export function validateRows<T extends Record<string, unknown>>(
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  descriptor: ImporterDescriptor<T>,
  orgId: string,
): RowResult<T>[] {
  const results: RowResult<T>[] = [];
  let rowNumber = 2; // header is line 1
  for (const raw of rows) {
    const projected: Record<string, string> = {};
    for (const [header, canonical] of Object.entries(mapping)) {
      if (canonical && raw[header] !== undefined && raw[header] !== "") {
        projected[canonical] = raw[header];
      }
    }
    const parsed = descriptor.rowSchema.safeParse(projected);
    if (!parsed.success) {
      const messages = parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      );
      results.push({ kind: "blocked", rowNumber, raw, messages });
    } else {
      const data = parsed.data;
      const idempotencyKey = computeIdempotencyKey(
        descriptor.idempotencyKeyParts(data, orgId),
      );
      results.push({ kind: "ok", rowNumber, data, idempotencyKey });
    }
    rowNumber++;
  }
  return results;
}
