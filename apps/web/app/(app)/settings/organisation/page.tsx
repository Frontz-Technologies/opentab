import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { CompanyForm } from "./company-form";

export default async function OrganisationSettingsPage() {
  const session = (await getSession())!;
  const t = await getTranslations("settings");
  const tNav = await getTranslations("nav");

  return (
    <>
      <PageHeader
        headingPrefix={tNav("settings")}
        heading={t("organisationHeading")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <CompanyForm
          initialData={{
            name: session.org.name,
            defaultCurrency: session.org.defaultCurrency,
            fiscalYearStart: session.org.fiscalYearStart,
            taxId: session.org.taxId ?? "",
            taxAuthority: session.org.taxAuthority ?? "",
            country: session.org.countryCode ?? "",
            addressLine1: session.org.addressLine1 ?? "",
            addressLine2: session.org.addressLine2 ?? "",
            city: session.org.city ?? "",
            postalCode: session.org.postalCode ?? "",
            region: session.org.region ?? "",
            phone: session.org.phone ?? "",
          }}
        />
      </main>
    </>
  );
}
