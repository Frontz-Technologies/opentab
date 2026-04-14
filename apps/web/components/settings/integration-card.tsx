import Link from "next/link";

interface IntegrationCardProps {
  icon: string;
  name: string;
  description: string;
  href: string;
  status: "connected" | "not_configured";
  statusLabels: { connected: string; notConfigured: string };
}

export function IntegrationCard({
  icon,
  name,
  description,
  href,
  status,
  statusLabels,
}: IntegrationCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-5 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors duration-200"
    >
      <div className="flex-shrink-0 size-10 rounded-lg bg-surface-container-high flex items-center justify-center">
        <span className="material-symbols-outlined text-[22px] text-on-surface-variant">
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-label text-sm font-semibold text-on-surface">
          {name}
        </p>
        <p className="text-xs text-on-surface-variant truncate">
          {description}
        </p>
      </div>
      <span
        className={`flex-shrink-0 font-label text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
          status === "connected"
            ? "bg-primary-container/20 text-primary"
            : "bg-surface-container-highest text-on-surface-variant"
        }`}
      >
        {status === "connected"
          ? statusLabels.connected
          : statusLabels.notConfigured}
      </span>
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:translate-x-0.5 transition-transform duration-200">
        chevron_right
      </span>
    </Link>
  );
}
