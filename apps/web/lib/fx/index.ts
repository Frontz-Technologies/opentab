/**
 * FX module — currency-rate lookups with cache → cross-rate → provider →
 * stale-fallback semantics. Public surface only; internals (providers,
 * cache helpers, jobs) are module-private.
 *
 * @example
 *   import { getFxRate, getFxRateWithFallback } from "@/lib/fx";
 *
 *   // Discriminated outcome:
 *   const result = await getFxRate(date, "EUR", "USD");
 *   if (result.kind === "Hit") use(result.value.rate);
 *
 *   // Legacy throw semantics (drop-in for the old getFxRate):
 *   const rate = await getFxRateWithFallback(date, "EUR", "USD");
 */
export { getFxRate, getFxRateWithFallback } from "./orchestrator";
export type { FxRate, FxResult, FxError } from "./types";
export {
  supportedCurrencies,
  isCurrencySupported,
} from "./registry";

/**
 * Test-only escape hatch — set a stub provider for unit tests.
 * Production code MUST NOT call this.
 */
export { __setActiveFxProviderForTesting } from "./registry";

export { runPrewarmRates } from "./jobs/prewarm-rates";
export type { PrewarmResult } from "./jobs/prewarm-rates";
export { runPruneCache } from "./jobs/prune-cache";
export type { PruneResult } from "./jobs/prune-cache";
