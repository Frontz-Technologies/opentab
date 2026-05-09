/**
 * FX rate result types — what `getFxRate` resolves to.
 *
 * The orchestrator returns a discriminated union so consumers can handle
 * each outcome explicitly. Use `getFxRateWithFallback` (a convenience wrapper)
 * if you just want the rate or a thrown error.
 */

/**
 * A single FX rate result. Carried by the `Hit` and `StaleFallbackUsed`
 * variants of `FxResult`.
 */
export interface FxRate {
  /** The rate as a number (e.g. 1.08 for EUR→USD on 2026-01-15). */
  rate: number;
  /**
   * The actual ECB business date the rate is from. May differ from the
   * caller-supplied date when the requested day was a weekend / holiday.
   */
  effectiveDate: Date;
  /** Provider id or stale-cache breadcrumb (e.g. "frankfurter", "stale:frankfurter"). */
  source: string;
}

/**
 * The error variants `getFxRate` may resolve to. These are surfaced when no
 * cache hit, no cross-rate, no live provider rate, AND no stale-fallback row
 * could satisfy the request.
 */
export type FxError =
  | { kind: "ProviderTimeout"; detail?: string }
  | { kind: "ProviderBadResponse"; detail: string }
  | { kind: "NoRateAvailable" };

/**
 * Discriminated outcome of `getFxRate`.
 *
 * - `Hit`: a fresh rate (cache, cross-rate, or live provider). Use `value.rate`.
 * - `StaleFallbackUsed`: the live provider failed; we returned the most-recent
 *   cached rate within the 7-day fallback window. `daysStale` is how many
 *   business days behind the requested date the returned rate is.
 * - Anything else: an `FxError` variant — display to the user or fail closed.
 */
export type FxResult =
  | { kind: "Hit"; value: FxRate }
  | { kind: "StaleFallbackUsed"; value: FxRate; daysStale: number }
  | FxError;
