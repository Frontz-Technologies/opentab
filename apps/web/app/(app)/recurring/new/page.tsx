import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { contacts, products } from "@opentab/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import { RecurringForm } from "./recurring-form";

export default async function NewRecurringPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("recurring");

  const clientContacts = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, session.org.id)))
    .orderBy(desc(contacts.createdAt));

  const activeProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.orgId, session.org.id), eq(products.active, true)))
    .orderBy(products.name);

  const provider = getCountryProvider(session.org.countryCode ?? null);
  const defaultTaxRate = String(provider.getDefaultVatRate());

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">
        {t("addRecurring")}
      </h1>
      <RecurringForm
        contacts={clientContacts}
        products={activeProducts}
        defaultCurrency={session.org.defaultCurrency}
        defaultTaxRate={defaultTaxRate}
      />
    </div>
  );
}
