import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { contacts, products } from "@opentab/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import { InvoiceForm } from "./invoice-form";

export default async function NewInvoicePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("invoices");

  const clientContacts = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.orgId, session.org.id),
        inArray(contacts.type, ["client", "both"]),
      ),
    )
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
        {t("addInvoice")}
      </h1>
      <InvoiceForm
        contacts={clientContacts}
        products={activeProducts}
        defaultCurrency={session.org.defaultCurrency}
        defaultTaxRate={defaultTaxRate}
      />
    </div>
  );
}
