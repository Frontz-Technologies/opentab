import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { randomBytes } from "crypto";

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
export function formatCurrencyCompact(
  amount: number,
  currency = "EUR",
): string {
  const abs = Math.abs(amount);
  if (abs >= 10_000) {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function detectCountryFromTaxId(taxId: string): string | null {
  const cleaned = taxId.trim().replace(/\s/g, "");
  if (/^\d{9}$/.test(cleaned)) return "GR";
  const euMatch = cleaned.match(/^([A-Z]{2})\d/);
  if (euMatch) {
    const euCountries = [
      "AT",
      "BE",
      "BG",
      "HR",
      "CY",
      "CZ",
      "DK",
      "EE",
      "FI",
      "FR",
      "DE",
      "GR",
      "HU",
      "IE",
      "IT",
      "LV",
      "LT",
      "LU",
      "MT",
      "NL",
      "PL",
      "PT",
      "RO",
      "SK",
      "SI",
      "ES",
      "SE",
    ];
    if (euCountries.includes(euMatch[1])) return euMatch[1];
  }
  return null;
}
