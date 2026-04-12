import { getSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { TopBar } from "@/components/layout/top-bar";
import { QuickSetup } from "@/components/onboarding/quick-setup";

export default async function DashboardPage() {
  // Layout already guards auth — session is guaranteed non-null
  const session = (await getSession())!;
  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");

  return (
    <>
      <TopBar breadcrumbs={[{ label: tNav("dashboard") }]} userName={session.user.name} userEmail={session.user.email} />
      <main className="px-8 py-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight mb-2">{t("title")}</h2>
          <p className="text-on-surface-variant">{t("welcome")}, {session.user.name.split(" ")[0]}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: t("revenue"), icon: "trending_up" },
                { label: t("outstanding"), icon: "schedule" },
                { label: t("expenses"), icon: "payments" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">{kpi.icon}</span>
                    <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">{kpi.label}</p>
                  </div>
                  <p className="font-label text-2xl font-bold text-on-surface">&euro;0.00</p>
                </div>
              ))}
            </div>
            <div className="bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10 min-h-[300px] flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-on-surface/20 mb-4">bar_chart</span>
              <p className="text-on-surface-variant text-sm">{t("noData")}</p>
              <p className="text-on-surface-variant/60 text-xs mt-1">Revenue and expense trends will appear here</p>
            </div>
            <div className="bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10 flex flex-col items-center justify-center min-h-[200px]">
              <span className="material-symbols-outlined text-4xl text-on-surface/20 mb-4">receipt_long</span>
              <p className="text-on-surface-variant text-sm mb-4">{t("createFirstInvoice")}</p>
              <button className="px-6 py-2.5 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95">+ New Invoice</button>
            </div>
          </div>
          <div>
            <QuickSetup completedSteps={(session.org.setupCompletedSteps as string[]) || []} />
          </div>
        </div>
      </main>
    </>
  );
}
