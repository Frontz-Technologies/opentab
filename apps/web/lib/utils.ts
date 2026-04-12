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
