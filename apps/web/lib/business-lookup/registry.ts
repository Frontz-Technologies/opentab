import { aadeSource } from "./sources/aade";
import { viesSource } from "./sources/vies";
import type { CompanyLookupSource } from "./source";

export const businessLookupSources: CompanyLookupSource[] = [
  aadeSource,
  viesSource,
];

export function isCountrySupportedByAnySource(
  countryCode: string | null,
): boolean {
  if (!countryCode) return false;
  return businessLookupSources.some((s) => s.supports(countryCode));
}
