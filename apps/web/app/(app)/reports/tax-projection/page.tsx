import { getSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getCountryProvider } from "@/lib/country";
import { TaxProjectionClient } from "./tax-projection-client";
import { getTaxProjectionData } from "../actions";

export default async function TaxProjectionPage() {
  const session = (await getSession())!;
  const provider = getCountryProvider(session.org.countryCode);

  if (!provider.capabilities.taxProjection) {
    redirect("/reports");
  }

  const t = await getTranslations("taxProjection");
  const tNav = await getTranslations("nav");

  const data = await getTaxProjectionData();

  return (
    <>
      <PageHeader
        headingPrefix={tNav("reports")}
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="px-8 py-8 max-w-7xl mx-auto">
        <p className="text-on-surface-variant mb-8">{t("year")}</p>
        <TaxProjectionClient initialData={data} />
      </main>
    </>
  );
}
