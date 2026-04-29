import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { expenseCategories, expenseGroups } from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { ensureCategoriesSeeded } from "@/lib/expenses/category-seed";
import { CategoryList } from "./category-list";

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("expenses");

  await ensureCategoriesSeeded(session.org.id, session.org.countryCode);

  const groups = await db
    .select()
    .from(expenseGroups)
    .where(eq(expenseGroups.active, true))
    .orderBy(asc(expenseGroups.sortOrder));

  const categories = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.orgId, session.org.id))
    .orderBy(asc(expenseCategories.sortOrder));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/expenses"
            className="text-on-surface/50 hover:text-on-surface transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            {t("categoriesTitle")}
          </h1>
        </div>
      </div>
      <CategoryList groups={groups} categories={categories} />
    </div>
  );
}
