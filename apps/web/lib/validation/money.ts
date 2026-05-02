import { z } from "zod";

// Normalize a money-shaped value (number or string from any source — AI
// extraction, CSV import, manual paste, legacy data) to a plain decimal
// string the server schema's strict regex accepts.
//
// Rules:
//   - null/undefined/non-string-or-number → fallback
//   - strip currency symbols €$£¥ + whitespace
//   - swap "," → "." (handles European decimal convention pasted into a
//     server-bound string regardless of the input UI)
//   - parse as Number; reject negatives / NaN / Infinity → fallback
//   - round via .toFixed(maxDecimals) so trailing zeros are dropped
//
// Used both as the safety net for AI extraction (lib/expenses/ai-extraction)
// and as the preprocess step inside the moneyString / taxRateString /
// quantityString Zod helpers below.
export function normalizeMoneyString(
  v: unknown,
  fallback: string,
  maxDecimals: number,
): string {
  let raw: string;
  if (v == null) return fallback;
  if (typeof v === "number") raw = String(v);
  else if (typeof v === "string") raw = v;
  else return fallback;

  const cleaned = raw
    .trim()
    .replace(/[€$£¥]/g, "")
    .trim()
    .replace(",", ".");
  if (cleaned === "") return fallback;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Number(n.toFixed(maxDecimals)).toString();
}

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;
const QUANTITY_REGEX = /^\d+(\.\d{1,4})?$/;

export const moneyString = z.preprocess(
  (v) => normalizeMoneyString(v, "0", 2),
  z.string().regex(MONEY_REGEX),
);

export const taxRateString = z.preprocess(
  (v) => normalizeMoneyString(v, "0", 2),
  z.string().regex(MONEY_REGEX),
);

export const quantityString = z.preprocess(
  (v) => normalizeMoneyString(v, "1", 4),
  z.string().regex(QUANTITY_REGEX),
);

export type NumberFormat = "us" | "eu" | "fr";

const SEPARATORS: Record<
  NumberFormat,
  { decimal: string; thousand: string }
> = {
  us: { decimal: ".", thousand: "," },
  eu: { decimal: ",", thousand: "." },
  fr: { decimal: ",", thousand: " " },
};

// Sentinel character (Unicode private-use area) used during separator swap
// to avoid collision when the target thousand separator is "," or ".".
const SENTINEL = "";

// Rewrites a canonical en-US-style numeric string ("1,234.56") into the
// requested format. Display-only — never touches stored values. Operates
// on the rendered output of Intl.NumberFormat("en", ...) so the input
// shape is predictable.
export function localizeSeparators(
  formatted: string,
  format: NumberFormat,
): string {
  const sep = SEPARATORS[format];
  // Replace in two passes via sentinel char to avoid swap collisions.
  return formatted
    .replace(/,/g, SENTINEL)
    .replace(/\./g, sep.decimal)
    .replace(new RegExp(SENTINEL, "g"), sep.thousand);
}

export const NUMBER_FORMATS: readonly NumberFormat[] = ["us", "eu", "fr"];
