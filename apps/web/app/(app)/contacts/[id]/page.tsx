import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { getCountryProvider } from "@/lib/country";
import { db } from "@/lib/db";
import { contacts } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { ContactForm } from "../new/contact-form";

interface EditContactPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditContactPage({
  params,
}: EditContactPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, session.org.id)))
    .limit(1);

  if (!contact) notFound();

  const t = await getTranslations("contacts");
  const provider = getCountryProvider(session.org.countryCode);

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">
        {t("editContact")}
      </h1>
      <ContactForm
        contact={contact}
        capabilities={provider.capabilities}
        taxOffices={provider.taxOffices}
        vatRates={provider.vatRates}
      />
    </div>
  );
}
