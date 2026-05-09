/**
 * FX module — currency-rate lookups with cache → cross-rate → provider →
 * stale-fallback semantics.
 *
 * Public surface: rate lookup (`getFxRate` + legacy `getFxRateWithFallback`),
 * sync currency metadata, the active-provider getter for settings UIs, and
 * the BullMQ-job entry points called by `lib/jobs/processors/fx-*`. Internal
 * to the module: provider classes, cache helpers, the FX_PIVOT constant.
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
export { supportedCurrencies, isCurrencySupported } from "./registry";

export { runPrewarmRates } from "./jobs/prewarm-rates";
export type { PrewarmResult } from "./jobs/prewarm-rates";
export { runPruneCache } from "./jobs/prune-cache";
export type { PruneResult } from "./jobs/prune-cache";

/**
 * Returns the active FX provider. Used by integration settings UIs to display
 * provider id / name / hosting. Production-side rate fetching uses
 * `getFxRate` / `getFxRateWithFallback` instead.
 */
export { getActiveFxProvider } from "./registry";
export type { FxProvider } from "./provider";
