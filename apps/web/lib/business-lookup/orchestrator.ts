import { detectCountryFromTaxId } from "@/lib/utils";
import { createLogger } from "@/lib/logging/logger";
import { businessLookupSources } from "./registry";
import type { CompanyLookupResult } from "./source";

const log = createLogger("business-lookup");

export async function lookupCompany(
  taxId: string,
  orgId: string,
): Promise<{
  result: CompanyLookupResult | null;
  sourceUsed: string | null;
}> {
  const start = Date.now();
  const country = detectCountryFromTaxId(taxId);

  if (!country) {
    log.info("lookup completed", {
      orgId,
      country: null,
      sourceUsed: null,
      ms: Date.now() - start,
    });
    return { result: null, sourceUsed: null };
  }

  const candidates: typeof businessLookupSources = [];
  for (const source of businessLookupSources) {
    if (!source.supports(country)) continue;
    if (!(await source.isAvailable(orgId))) continue;
    candidates.push(source);
  }
  candidates.sort((a, b) => a.priority - b.priority);

  let attempted = 0;
  let threwCount = 0;

  for (const source of candidates) {
    attempted += 1;
    try {
      const result = await source.lookup(taxId, orgId);
      if (result) {
        log.info("lookup completed", {
          orgId,
          country,
          sourceUsed: source.id,
          ms: Date.now() - start,
        });
        return { result, sourceUsed: source.id };
      }
    } catch (err) {
      threwCount += 1;
      log.error("source threw", {
        orgId,
        country,
        sourceId: source.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (attempted > 0 && threwCount === attempted) {
    log.warn("all sources threw for country", {
      orgId,
      country,
      attempted,
      ms: Date.now() - start,
    });
  }

  log.info("lookup completed", {
    orgId,
    country,
    sourceUsed: null,
    ms: Date.now() - start,
  });
  return { result: null, sourceUsed: null };
}
