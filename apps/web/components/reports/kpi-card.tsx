interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  changePercent: number | null;
  secondary: string;
}

export function KpiCard({
  label,
  value,
  icon,
  changePercent,
  secondary,
}: KpiCardProps) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-on-surface-variant text-lg">
          {icon}
        </span>
        <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
          {label}
        </p>
      </div>
      <p className="font-headline text-2xl font-bold text-on-surface">
        {value}
      </p>
      <div className="flex items-center gap-2 mt-1">
        {changePercent !== null && (
          <span
            className={`text-xs font-medium flex items-center gap-0.5 ${
              changePercent >= 0 ? "text-emerald-400" : "text-red-400"
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
