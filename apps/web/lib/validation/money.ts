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

export const SEPARATORS: Record<
  NumberFormat,
  { decimal: string; thousand: string }
> = {
  us: { decimal: ".", thousand: "," },
  eu: { decimal: ",", thousand: "." },
  fr: { decimal: ",", thousand: " " },
};

// Unicode private-use codepoint used as a sentinel during the swap. Safe
// because Intl.NumberFormat("en", ...) only ever emits ASCII digits, "," ".",
// currency symbols, whitespace, "K"/"M" suffixes and "-" — never U+E000.
const SENTINEL = "";

export function localizeSeparators(
  formatted: string,
  format: NumberFormat,
): string {
  // The us format IS the canonical en output — skip the rewrite entirely.
  // MoneyDisplay renders dozens of values per line-items grid, so cutting
  // three regex passes for the most common branch is worthwhile.
  if (format === "us") return formatted;
  const sep = SEPARATORS[format];
  return formatted
    .replace(/,/g, SENTINEL)
    .replace(/\./g, sep.decimal)
    .replace(new RegExp(SENTINEL, "g"), sep.thousand);
}

export const NUMBER_FORMATS: readonly NumberFormat[] = ["us", "eu", "fr"];
