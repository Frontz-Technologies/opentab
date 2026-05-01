import type { CompanyLookupResult } from "@/lib/country/types";

export type { CompanyLookupResult };

export interface CompanyLookupSource {
  /** Stable id used in logs and as a registry key. */
  id: string;
  /** Human-readable name shown in the integrations card description. */
  displayName: string;
  /** Whether this source can lookup tax IDs for the given ISO 3166-1 alpha-2 country. */
  supports(countryCode: string): boolean;
  /** Lower = tried first. Country-specific < pan-EU < global. */
  priority: number;
  /**
   * Anonymous sources return true; credentialed sources check env or
   * per-org credentials. v1 ships only anonymous sources.
   */
  isAvailable(orgId: string): Promise<boolean>;
  /** Performs the lookup. Returns null on miss; never throws during normal operation. */
  lookup(taxId: string, orgId: string): Promise<CompanyLookupResult | null>;
}
