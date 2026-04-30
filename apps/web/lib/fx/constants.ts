import type { SupportedCurrencyCode } from "@/lib/currency/supported";

/** The base currency we use as the cross-rate pivot. ECB publishes
 *  daily reference rates against EUR, so all cross-rates flow through
 *  it. Changing this requires re-thinking the cross-rate algorithm. */
export const FX_PIVOT: SupportedCurrencyCode = "EUR";
