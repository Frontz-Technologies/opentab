import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { contacts, expenseCategories, expenseGroups } from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import { ensureCategoriesSeeded } from "@/lib/expenses/category-seed";
import { RecurringExpenseForm } from "./recurring-expense-form";

export default async function NewRecurringExpensePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("recurringExpenses");

  await ensureCategoriesSeeded(session.org.id, session.org.countryCode);

  const supplierContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.orgId, session.org.id))
    .orderBy(contacts.displayName);

  const groups = await db
    .select()
    .from(expenseGroups)
    .where(eq(expenseGroups.active, true))
    .orderBy(asc(expenseGroups.sortOrder));

  const categories = await db
    .select()
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.orgId, session.org.id),
        eq(expenseCategories.active, true),
      ),
    )
    .orderBy(asc(expenseCategories.sortOrder));

  const provider = getCountryProvider(session.org.countryCode ?? null);
  const defaultTaxRate = String(provider.getDefaultVatRate());

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">
        {t("addRecurring")}
      </h1>
      <RecurringExpenseForm
        contacts={supplierContacts}
        groups={groups}
        categories={categories}
        defaultCurrency={session.org.defaultCurrency}
        defaultTaxRate={defaultTaxRate}
      />
    </div>
  );
}
