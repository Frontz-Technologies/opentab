import { getSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCountryProvider } from "@/lib/country";
import { ReportsTabs } from "../reports-tabs";

export default async function TaxProjectionPage() {
  const session = (await getSession())!;
  const provider = getCountryProvider(session.org.countryCode);

  if (!provider.capabilities.taxProjection) {
    redirect("/reports");
  }

  const t = await getTranslations("taxProjection");
  const tNav = await getTranslations("nav");

  return (
    <>
      <PageHeader
        headingPrefix={tNav("reports")}
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="px-8 py-8 max-w-7xl mx-auto">
        <ReportsTabs active="taxProjection" provider={provider} />
        <div className="bg-surface-container-low rounded-2xl p-12 flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
            schedule
          </span>
          <h3 className="font-headline text-xl font-semibold text-on-surface mb-2">
            {t("comingSoonTitle")}
          </h3>
          <p className="text-sm text-on-surface-variant max-w-md">
            {t("comingSoonSubtext")}
          </p>
        </div>
      </main>
    </>
  );
}
