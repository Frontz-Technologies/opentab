import { getSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { QuickSetup } from "@/components/onboarding/quick-setup";
import { KpiCard } from "@/components/reports/kpi-card";
import { DashboardClient } from "./dashboard-client";
import { DashboardGreeting } from "./dashboard-greeting";
import { getDashboardData, hasAnyData } from "./actions";
import type { PeriodKey } from "@/lib/reports/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = (await getSession())!;
  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");

  const params = await searchParams;
  const period = (params.period as PeriodKey) || "month";
  const dataExists = await hasAnyData();

  return (
    <>
      <PageHeader userName={session.user.name} userEmail={session.user.email} />
      <main className="px-6 py-8 max-w-7xl mx-auto">
        <DashboardGreeting userName={session.user.name} />
        {dataExists ? (
          <DashboardWithData period={period} session={session} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    label: t("revenue"),
                    icon: "trending_up",
                    variant: "hero" as const,
                  },
                  { label: t("outstanding"), icon: "schedule" },
                  { label: t("expenses"), icon: "payments" },
                ].map((kpi) => (
                  <KpiCard
                    key={kpi.label}
                    label={kpi.label}
                    value="€0.00"
                    icon={kpi.icon}
                    changePercent={null}
                    secondary=""
                    variant={kpi.variant}
                  />
                ))}
              </div>
              <div className="bg-surface-container-low rounded-2xl p-8 min-h-[300px] flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-on-surface/20 mb-4">
                  bar_chart
                </span>
                <p className="text-on-surface-variant text-sm">{t("noData")}</p>
              </div>
            </div>
            <div>
              <QuickSetup
                completedSteps={
                  (session.org.setupCompletedSteps as string[]) || []
                }
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

async function DashboardWithData({
  period,
  session,
}: {
  period: PeriodKey;
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
}) {
  const result = await getDashboardData(period);
  const { insights, ...data } = result;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3">
        <DashboardClient initialData={data} initialInsights={insights} />
      </div>
      <div>
        <QuickSetup
          completedSteps={(session.org.setupCompletedSteps as string[]) || []}
        />
      </div>
    </div>
  );
}
