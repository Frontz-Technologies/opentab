import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { getCountryProvider } from "@/lib/country";

type ReportTab = "pnl" | "vat" | "taxProjection";

interface ReportsTabsProps {
  active: ReportTab;
  provider: ReturnType<typeof getCountryProvider>;
}

// Shared subnav rendered by each /reports/* sub-page just below the
// PageHeader. Mirrors the tab-toggle pattern used elsewhere in the app
// (AnimatedFilterBar) but these are full Next.js route links so each
// tab is deep-linkable and the right sub-page loads natively. Locked
// tabs (capability-gated) render as disabled-looking links that still
// navigate to /settings/organisation so the user knows where to go
// next to unlock them.
export async function ReportsTabs({ active, provider }: ReportsTabsProps) {
  const t = await getTranslations("reports");
  const tabs: {
    key: ReportTab;
    label: string;
    href: string;
    locked: boolean;
  }[] = [
    {
      key: "pnl",
      label: t("pnl"),
      href: "/reports/pnl",
      locked: false,
    },
    {
      key: "vat",
      label: t("vat"),
      href: "/reports/vat",
      locked: !provider.capabilities.vatReport,
    },
    {
      key: "taxProjection",
      label: t("taxProjection"),
      href: "/reports/tax-projection",
      locked: !provider.capabilities.taxProjection,
    },
  ];
  return (
    <nav
      aria-label={t("title")}
      className="bg-surface-container-low rounded-full p-1 inline-flex gap-1 mb-8"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const href = tab.locked ? "/settings/organisation" : tab.href;
        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-sm font-label transition-colors",
              isActive && "bg-primary-container/20 text-primary font-semibold",
              !isActive &&
                !tab.locked &&
                "text-on-surface hover:bg-surface-container-high",
              tab.locked && "text-outline hover:text-on-surface-variant",
            )}
          >
            {tab.label}
            {tab.locked && (
              <span className="material-symbols-outlined text-[14px] leading-none">
                lock
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
