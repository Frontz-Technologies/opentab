export const EU_COUNTRY_CODES = new Set<string>([
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
]);

// VIES (the EU VAT validation service) uses two prefixes that diverge from
// ISO 3166-1 alpha-2: EL for Greece (ISO: GR), and historically UK for the
// United Kingdom (ISO: GB) before Brexit removed UK from VIES. Map any
// VIES-specific prefix back to its ISO code.
export const VIES_TO_ISO_PREFIX = new Map<string, string>([["EL", "GR"]]);

export function isEuCountry(code: string): boolean {
  return EU_COUNTRY_CODES.has(code);
}
