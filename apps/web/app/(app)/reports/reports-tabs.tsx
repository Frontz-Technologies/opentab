import { getTranslations } from "next-intl/server";
import type { getCountryProvider } from "@/lib/country";
import { AnimatedFilterBar } from "@/components/ui/animated-filter-bar";

type ReportTab = "pnl" | "vat" | "taxProjection";

interface ReportsTabsProps {
  active: ReportTab;
  provider: ReturnType<typeof getCountryProvider>;
}

export async function ReportsTabs({ active, provider }: ReportsTabsProps) {
  const t = await getTranslations("reports");
  const items = [
    { value: "pnl" as const, label: t("pnl"), href: "/reports/pnl" },
    {
      value: "vat" as const,
      label: t("vat"),
      href: provider.capabilities.vatReport
        ? "/reports/vat"
        : "/settings/organisation",
      disabled: !provider.capabilities.vatReport,
    },
    {
      value: "taxProjection" as const,
      label: t("taxProjection"),
      href: provider.capabilities.taxProjection
        ? "/reports/tax-projection"
        : "/settings/organisation",
      disabled: !provider.capabilities.taxProjection,
    },
  ];
  return (
    <div className="mb-8">
      <AnimatedFilterBar items={items} value={active} />
    </div>
  );
}
