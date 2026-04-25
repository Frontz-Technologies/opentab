import { z } from "zod";
import { invoiceSequences } from "@opentab/db/schema";

export { invoiceSequences };
export type { InvoiceSequence, NewInvoiceSequence } from "@opentab/db/schema";

// Recognised placeholders in a pattern string. Anything else stays
// literal — `INV-{year}/foo/{counter:4}` resolves the placeholders
// and leaves `/foo/` intact.
export const PATTERN_PLACEHOLDERS = [
  "{prefix}",
  "{year}",
  "{month}",
  "{counter}",
  // {counter:N} where N is 1..10 — covered by regex below.
] as const;

// Pattern grammar:
//   - {prefix}, {year}, {month}, {counter} → fixed placeholders
//   - {counter:N} → counter zero-padded to N digits, N in 1..10
//   - any other characters → literal
//
// Length cap of 60 keeps the rendered number well under the
// invoice_number column's 50-char limit even with a 6-digit counter
// and a 4-digit year.
export const numberingPatternSchema = z
  .string()
  .min(1)
  .max(60)
  .refine(
    (s) => /\{counter(:\d+)?\}/.test(s),
    "Pattern must include a {counter} or {counter:N} placeholder",
  )
  .refine(
    (s) => !/\{counter:(\d+)\}/.test(s) || /\{counter:([1-9]|10)\}/.test(s),
    "Counter padding must be between 1 and 10 digits",
  );

export const updateInvoiceNumberingSchema = z.object({
  prefix: z.string().min(1).max(20),
  digitCount: z.coerce.number().int().min(3).max(10),
  includeYear: z.coerce.boolean(),
  pattern: z
    .string()
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null))
    .pipe(numberingPatternSchema.nullable()),
});
