"use client";

import { NumericFormat } from "react-number-format";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { useNumberFormat } from "@/components/providers/number-format-provider";
import type { NumberFormat } from "@/lib/validation/money";

const SEPARATORS: Record<
  NumberFormat,
  { decimal: string; thousand: string }
> = {
  us: { decimal: ".", thousand: "," },
  eu: { decimal: ",", thousand: "." },
  fr: { decimal: ",", thousand: " " },
};

type MoneyInputProps = {
  value: string;
  onChange: (next: string) => void;
  decimalScale?: 2 | 4;
  allowNegative?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
} & Omit<
  ComponentPropsWithoutRef<"input">,
  "value" | "onChange" | "type" | "step"
>;

export function MoneyInput({
  value,
  onChange,
  decimalScale = 2,
  allowNegative = false,
  placeholder,
  disabled,
  className,
  ...rest
}: MoneyInputProps) {
  const fmt = useNumberFormat();
  const sep = SEPARATORS[fmt];

  return (
    <NumericFormat
      value={value}
      onValueChange={(values) => onChange(values.value ?? "")}
      decimalSeparator={sep.decimal}
      thousandSeparator={sep.thousand}
      decimalScale={decimalScale}
      fixedDecimalScale={false}
      allowedDecimalSeparators={[".", ","]}
      allowNegative={allowNegative}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "h-8 w-full rounded-lg border border-border bg-input px-2.5 py-1 text-sm text-right font-mono outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...rest}
    />
  );
}
