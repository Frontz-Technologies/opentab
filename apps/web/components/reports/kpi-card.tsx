interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  changePercent: number | null;
  secondary: string;
  variant?: "default" | "hero";
}

export function KpiCard({
  label,
  value,
  icon,
  changePercent,
  secondary,
  variant = "default",
}: KpiCardProps) {
  const valueClass =
    variant === "hero"
      ? "font-headline text-4xl sm:text-5xl font-bold text-on-surface leading-none tracking-tight"
      : "font-headline text-3xl sm:text-4xl font-bold text-on-surface leading-none tracking-tight";

  return (
    <div className="bg-surface-container-low rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4 min-w-0">
        <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0">
          {icon}
        </span>
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
            <span className="material-symbols-outlined text-sm">
              {changePercent >= 0 ? "arrow_upward" : "arrow_downward"}
            </span>
            {Math.abs(changePercent).toFixed(1)}%
          </span>
        )}
        <span className="text-xs text-on-surface-variant">{secondary}</span>
      </div>
    </div>
  );
}
