import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { contacts } from "@opentab/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import { ExpenseForm } from "../expense-form";
import { getCategories } from "../categories/actions";

export default async function NewExpensePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("expenses");

  const supplierContacts = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.orgId, session.org.id),
        inArray(contacts.type, ["supplier", "both"]),
      ),
    )
    .orderBy(desc(contacts.createdAt));

  const categories = await getCategories(session.org.id);

  const provider = getCountryProvider(session.org.countryCode ?? null);
  const defaultTaxRate = String(provider.getDefaultVatRate());

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">
        {t("addExpense")}
      </h1>
      <ExpenseForm
        contacts={supplierContacts}
        categories={categories}
        defaultCurrency={session.org.defaultCurrency}
        defaultTaxRate={defaultTaxRate}
      />
    </div>
  );
}
