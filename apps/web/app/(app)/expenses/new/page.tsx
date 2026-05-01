import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { contacts, expenseCategories, expenseGroups } from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import { ensureCategoriesSeeded } from "@/lib/expenses/category-seed";
import { loadSeedFromSource } from "@/lib/expenses/seed-from-source";
import { ExpenseForm } from "./expense-form";
import { isReceiptExtractionEnabled } from "@/lib/actions/ai-settings";

const fromIdSchema = z.string().uuid();

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("expenses");

  const params = await searchParams;
  const rawFromId = typeof params.from === "string" ? params.from : null;
  const fromId =
    rawFromId && fromIdSchema.safeParse(rawFromId).success ? rawFromId : null;
  const seed = await loadSeedFromSource(db, session.org.id, fromId);

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
  const aiExtractionAvailable = await isReceiptExtractionEnabled(
    session.org.id,
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">
        {t("addExpense")}
      </h1>
      <ExpenseForm
        contacts={supplierContacts}
        groups={groups}
        categories={categories}
        defaultCurrency={session.org.defaultCurrency}
        defaultTaxRate={defaultTaxRate}
        aiExtractionAvailable={aiExtractionAvailable}
        seed={seed}
      />
    </div>
  );
}
