import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getCategories } from "./actions";
import { CategoryTree } from "./category-tree";

export default async function ExpenseCategoriesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("expenseCategories");

  const categories = await getCategories(session.org.id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/expenses"
            className="text-on-surface/50 hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            {t("title")}
          </h1>
        </div>
      </div>
      <CategoryTree categories={categories} orgId={session.org.id} />
    </div>
  );
}
