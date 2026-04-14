import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { CompanyForm } from "./company-form";

export default async function OrganisationSettingsPage() {
  const session = (await getSession())!;

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Organisation" },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-8">
          Organisation Settings
        </h2>
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
