import type { CountryProvider } from "./types";
import { internationalProvider } from "./providers/international";
import { greeceProvider } from "./providers/gr";

export type {
  CountryProvider,
  VatRate,
  TaxOffice,
  CompanyLookupResult,
  TaxCodeMapping,
} from "./types";

const providers = new Map<string, CountryProvider>();
providers.set("GR", greeceProvider);

export function getCountryProvider(code: string | null): CountryProvider {
  if (!code) return internationalProvider;
  return providers.get(code) ?? internationalProvider;
}
