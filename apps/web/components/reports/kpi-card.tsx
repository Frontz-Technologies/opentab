import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  changePercent: number | null;
  secondary: string;
  variant?: "default" | "hero";
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  changePercent,
  secondary,
  variant = "default",
}: KpiCardProps) {
  const valueClass =
    variant === "hero"
      ? "font-headline text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface leading-none tracking-tight tabular-nums truncate"
      : "font-headline text-2xl sm:text-3xl lg:text-4xl font-bold text-on-surface leading-none tracking-tight tabular-nums truncate";

  return (
    <div className="bg-surface-container-low rounded-2xl p-6 min-w-0">
      <div className="flex items-center gap-2 mb-4 min-w-0">
        <Icon className="h-[18px] w-[18px] text-on-surface-variant shrink-0" />
        <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant truncate">
          {label}
        </p>
      </div>
      <p className={valueClass}>{value}</p>
      <div className="flex items-center gap-2 mt-3">
        {changePercent !== null && (
          <span
            className={`text-xs font-label font-medium flex items-center gap-0.5 ${
              changePercent >= 0 ? "text-primary" : "text-tertiary"
            }`}
          >
            {changePercent >= 0 ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
            {Math.abs(changePercent).toFixed(1)}%
          </span>
        )}
        <span className="text-xs text-on-surface-variant">{secondary}</span>
      </div>
    </div>
  );
}
