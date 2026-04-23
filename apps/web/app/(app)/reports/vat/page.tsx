import { getSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCountryProvider } from "@/lib/country";
import { ReportsTabs } from "../reports-tabs";
import { VatClient } from "./vat-client";

export default async function VatReportPage() {
  const session = (await getSession())!;
  const provider = getCountryProvider(session.org.countryCode);

  if (!provider.capabilities.vatReport) {
    redirect("/reports");
  }

  const t = await getTranslations("reports");
  const tNav = await getTranslations("nav");

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  return (
    <>
      <PageHeader
        headingPrefix={tNav("reports")}
        heading={t("vat")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="px-8 py-8 max-w-7xl mx-auto">
        <ReportsTabs active="vat" provider={provider} />
        <VatClient defaultStart={startDate} defaultEnd={endDate} />
      </main>
    </>
  );
}
