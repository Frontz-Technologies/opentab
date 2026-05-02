"use client";

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { useNumberFormat } from "@/components/providers/number-format-provider";
import { localizeSeparators } from "@/lib/validation/money";

type MoneyDisplayProps = {
  amount: number | string;
  currencyCode: string;
  align?: "left" | "right";
  compact?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"span">, "className" | "children">;

// Intl.NumberFormat construction is non-trivial — it parses currency
// metadata + locale rules. A line-items grid with N rows × 4 money cells
// (qty * price, taxAmount, lineTotal, totals footer) re-runs the constructor
// on every render. Cache by (currency, compact) so repeat renders reuse the
// same formatter instance. Bounded by the small set of currencies an org
// uses; Intl objects don't hold mutable state.
const formatterCache = new Map<string, Intl.NumberFormat>();
function getFormatter(
  currencyCode: string,
  compact: boolean,
): Intl.NumberFormat {
  const key = `${currencyCode}|${compact ? "c" : "f"}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(
      "en",
      compact
        ? {
            style: "currency",
            currency: currencyCode,
            notation: "compact",
            maximumFractionDigits: 1,
          }
        : {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
    );
    formatterCache.set(key, f);
  }
  return f;
}

export function MoneyDisplay({
  amount,
  currencyCode,
  align = "left",
  compact = false,
  className,
  ...rest
}: MoneyDisplayProps) {
  const fmt = useNumberFormat();
  const n = typeof amount === "number" ? amount : parseFloat(amount);
  const alignClass = align === "right" ? "text-right" : "text-left";

  if (!Number.isFinite(n)) {
    return (
      <span className={cn("inline-block", alignClass, className)} {...rest}>
        —
      </span>
    );
  }

  const localized = localizeSeparators(
    getFormatter(currencyCode, compact).format(n),
    fmt,
  );

  return (
    <span className={cn("inline-block", alignClass, className)} {...rest}>
      {localized}
    </span>
  );
}
