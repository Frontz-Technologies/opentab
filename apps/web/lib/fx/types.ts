/**
 * FX rate result type — what `getFxRate` resolves to.
 *
 * The orchestrator returns a discriminated union so consumers can handle
 * each outcome explicitly. Use `getFxRateWithFallback` (a convenience wrapper)
 * if you just want the rate or a thrown error.
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

export type FxError =
  | { kind: "ProviderTimeout"; detail?: string }
  | { kind: "ProviderBadResponse"; detail: string }
  | { kind: "NoRateAvailable" };

export type FxResult =
  | { kind: "Hit"; value: FxRate }
  | { kind: "StaleFallbackUsed"; value: FxRate; daysStale: number }
  | FxError;
