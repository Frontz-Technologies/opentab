import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { getCountryProvider } from "@/lib/country";
import { ContactForm } from "./contact-form";

export default async function NewContactPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("contacts");
  const provider = getCountryProvider(session.org.countryCode);

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">
        {t("addContact")}
      </h1>
      <ContactForm
        capabilities={provider.capabilities}
        taxOffices={provider.taxOffices}
        vatRates={provider.vatRates}
      />
    </div>
  );
}
