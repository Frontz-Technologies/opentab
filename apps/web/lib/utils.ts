import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { randomBytes } from "crypto";
import { localizeSeparators, type NumberFormat } from "./validation/money";
import { EU_COUNTRY_CODES, VIES_TO_ISO_PREFIX } from "./country/eu-codes";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateUniqueSlug(base: string): string {
  const slug = slugify(base);
  const suffix = randomBytes(4).toString("hex");
  return `${slug}-${suffix}`;
}

// Formats a currency amount for at-a-glance display. Values ≥ 10,000
// Use on dashboard KPI cards (compact for ≥10K, full precision below).
// Never use on invoice / report / PDF surfaces — precision matters there.
// numberFormat defaults to "eu" — server-side callers without access to
// the user's preference get the org-default convention; client surfaces
// should prefer <MoneyDisplay compact /> which reads the live setting.
export function formatCurrencyCompact(
  amount: number,
  currency = "EUR",
  numberFormat: NumberFormat = "eu",
): string {
  const abs = Math.abs(amount);
  const base =
    abs >= 10_000
      ? new Intl.NumberFormat("en", {
          style: "currency",
          currency,
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(amount)
      : new Intl.NumberFormat("en", {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
  return localizeSeparators(base, numberFormat);
}

export function detectCountryFromTaxId(taxId: string): string | null {
  const cleaned = taxId.trim().replace(/\s/g, "").toUpperCase();
  if (/^\d{9}$/.test(cleaned)) return "GR";
  const euMatch = cleaned.match(/^([A-Z]{2})\d/);
  if (euMatch) {
    const prefix = VIES_TO_ISO_PREFIX.get(euMatch[1]) ?? euMatch[1];
    if (EU_COUNTRY_CODES.has(prefix)) return prefix;
  }
  return null;
}
