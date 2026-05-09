import type { SupportedCurrencyCode } from "@/lib/currency";

export interface FxRateLookup {
  /** The date we asked the provider for. The provider may roll to the
   *  prior business day if the requested date is a weekend / holiday. */
  requestedDate: Date;
  /** The actual ECB business date the rate is from. Equal to requestedDate
   *  except across weekends / holidays. */
  effectiveDate: Date;
  rate: number;
}

export interface FxRatesAgainstBaseLookup {
  requestedDate: Date;
  effectiveDate: Date;
  /** Map of quote currency code → rate against the base. */
  rates: Record<string, number>;
}

/**
 * Contract for an FX-rate provider. The orchestrator queries `getRate` for
 * single-pair lookups; the prewarm cron uses `getRatesAgainstBase` to pull
 * a whole day's rates against EUR in one call.
 *
 * Implementations live in `apps/web/lib/fx/providers/` and are wired into
 * the runtime via `apps/web/lib/fx/registry.ts`. v1 hard-codes the
 * `FrankfurterProvider`; v2 will read from settings.
 */
export interface FxProvider {
  readonly id: string;
  readonly displayName: string;
  readonly hosting: string;
  readonly supportedCurrencies: ReadonlySet<SupportedCurrencyCode>;
  getRate(
    date: Date,
    from: SupportedCurrencyCode,
    to: SupportedCurrencyCode,
  ): Promise<FxRateLookup>;
  getRatesAgainstBase(
    date: Date,
    base: SupportedCurrencyCode,
  ): Promise<FxRatesAgainstBaseLookup>;
}
