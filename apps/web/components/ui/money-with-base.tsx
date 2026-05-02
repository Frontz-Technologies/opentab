// Renders a per-entity monetary amount with its original currency, and
// adds a secondary line with the base-currency equivalent when the
// entity's currency differs from the org's default.
//
// All entity rows in /reports, /dashboard and adjacent entity-list
// pages should use this so foreign-currency entries are unambiguous:
// users see what they invoiced/spent in the contract currency AND how
// it lands in their books.
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { MoneyDisplay } from "@/components/ui/money-display";

type MoneyWithBaseProps = {
  amount: string | number; // raw entity amount (string from numeric column or number)
  currencyCode: string;
  exchangeRate: string | number; // numeric(12,6) snapshot, "1.000000" for base
  baseCurrency: string;
  // When the entity is a credit note we want the value to render as
  // negative (matching the existing `-{total}` convention) without
  // baking the sign into the data column.
  negate?: boolean;
  // Layout — list rows want stacked, summary cells want inline.
  align?: "right" | "left";
  className?: string;
} & Omit<ComponentPropsWithoutRef<"span">, "className">;

export function MoneyWithBase({
  amount,
  currencyCode,
  exchangeRate,
  baseCurrency,
  negate = false,
  align = "right",
  className,
  ...rest
}: MoneyWithBaseProps) {
  const raw = typeof amount === "number" ? amount : parseFloat(amount);
  const rateNumber =
    typeof exchangeRate === "number" ? exchangeRate : parseFloat(exchangeRate);
  const rateValid = Number.isFinite(rateNumber) && rateNumber > 0;
  const original = negate ? -raw : raw;
  const isForeign = currencyCode !== baseCurrency;
  const alignClass = align === "right" ? "text-right" : "text-left";

  if (isForeign && !rateValid) {
    console.warn(
      "MoneyWithBase: non-finite exchangeRate, rendering placeholder",
      { exchangeRate, currencyCode, baseCurrency },
    );
  }

  return (
    <span
      {...rest}
      className={cn("inline-flex flex-col", alignClass, className)}
    >
      <MoneyDisplay
        amount={original}
        currencyCode={currencyCode}
        align={align}
      />
      {isForeign && (
        <span className="text-on-surface-variant text-xs">
          {"≈ "}
          <MoneyDisplay
            amount={rateValid ? original * rateNumber : Number.NaN}
            currencyCode={baseCurrency}
            align={align}
          />
        </span>
      )}
    </span>
  );
}
