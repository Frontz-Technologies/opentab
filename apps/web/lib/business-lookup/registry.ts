import { gemiPublicSource } from "./sources/gemi-public";
import { viesSource } from "./sources/vies";
import type { CompanyLookupSource } from "./source";

export const businessLookupSources: CompanyLookupSource[] = [
  gemiPublicSource,
  viesSource,
];

export function isCountrySupportedByAnySource(
  countryCode: string | null,
): boolean {
  if (!countryCode) return false;
  return businessLookupSources.some((s) => s.supports(countryCode));
}
