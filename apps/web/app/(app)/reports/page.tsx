import { getSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { getCountryProvider } from "@/lib/country";
import Link from "next/link";

const reportCards = [
  {
    key: "pnl",
    icon: "summarize",
    href: "/reports/pnl",
    capability: null,
  },
  {
    key: "vat",
    icon: "receipt",
    href: "/reports/vat",
    capability: "vatReport" as const,
  },
  {
    key: "taxProjection",
    icon: "calculate",
    href: "/reports/tax-projection",
    capability: "taxProjection" as const,
  },
];

export default async function ReportsPage() {
  const session = (await getSession())!;
  const t = await getTranslations("reports");
  const tNav = await getTranslations("nav");

  const provider = getCountryProvider(session.org.countryCode);

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="px-8 py-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportCards.map((card) => {
            const unlocked =
              !card.capability || provider.capabilities[card.capability];
            if (unlocked) {
              return (
                <Link
                  key={card.key}
                  href={card.href}
                  className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 hover:border-primary/30 hover:bg-surface-container-low/80 transition-all group"
                >
                  <span className="material-symbols-outlined text-3xl text-primary mb-4 block">
                    {card.icon}
                  </span>
                  <h3 className="font-headline text-lg font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">
                    {t(card.key)}
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    {t(`${card.key}Description`)}
                  </p>
                </Link>
              );
            }
            return (
              <Link
                key={card.key}
                href="/settings/organisation"
                className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 hover:border-primary/30 hover:bg-surface-container-low/80 transition-all group relative"
                data-locked="true"
              >
                <span className="material-symbols-outlined text-3xl text-on-surface/40 mb-4 block">
                  {card.icon}
                </span>
                <h3 className="font-headline text-lg font-bold text-on-surface/60 mb-1">
                  {t(card.key)}
                </h3>
                <p className="text-sm text-on-surface-variant/70 mb-4">
                  {t(`${card.key}Description`)}
                </p>
                <p className="inline-flex items-center gap-1.5 text-xs font-label uppercase tracking-widest text-primary">
                  <span className="material-symbols-outlined text-[14px]">
                    arrow_forward
                  </span>
                  {t("setCountryCta")}
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
