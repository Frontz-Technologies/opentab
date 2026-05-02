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

  const baseFormatted = compact
    ? new Intl.NumberFormat("en", {
        style: "currency",
        currency: currencyCode,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n)
    : new Intl.NumberFormat("en", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);

  const localized = localizeSeparators(baseFormatted, fmt);

  return (
    <span className={cn("inline-block", alignClass, className)} {...rest}>
      {localized}
    </span>
  );
}
