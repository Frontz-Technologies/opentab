"use client";

import { useRef, useCallback } from "react";

function formatCurrency(value: number): string {
  return `\u20AC${value.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function TaxProjectionSlider({
  defaultRevenue,
  min = 0,
  max = 200000,
  onChange,
}: {
  defaultRevenue: number;
  min?: number;
  max?: number;
  onChange: (revenue: number) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(value), 50);
    },
    [onChange],
  );

  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={500}
        defaultValue={defaultRevenue}
        onChange={handleChange}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-surface-container accent-primary"
      />
      <div className="flex justify-between text-xs text-on-surface-variant mt-1">
        <span>{formatCurrency(min)}</span>
        <span className="font-bold text-on-surface">
          {formatCurrency(defaultRevenue)}
        </span>
        <span>{formatCurrency(max)}</span>
      </div>
    </div>
  );
}
