import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { expenses } from "@opentab/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { ExpenseList } from "./expense-list";
import { Pagination } from "@/components/ui/pagination";
import {
  parsePage,
  paginationOffset,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("expenses");
  const params = await searchParams;
  const page = parsePage(params);

  const [allExpenses, [{ total }]] = await Promise.all([
    db
      .select()
      .from(expenses)
      .where(eq(expenses.orgId, session.org.id))
      .orderBy(desc(expenses.createdAt))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(paginationOffset(page)),
    db
      .select({ total: count() })
      .from(expenses)
      .where(eq(expenses.orgId, session.org.id)),
  ]);

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <div className="flex gap-2">
            <Link
              href="/expenses/categories"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-on-surface/10 text-on-surface/60 font-medium text-sm hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                category
              </span>
              {t("categories")}
            </Link>
            <Link
              href="/expenses/new"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                add
              </span>
              {t("addExpense")}
            </Link>
          </div>
        }
      />
      <div className="px-6 py-6">
        <ExpenseList expenses={allExpenses} />
        <Pagination
          totalItems={total}
          pageSize={DEFAULT_PAGE_SIZE}
          currentPage={page}
          className="mt-6"
        />
      </div>
    </>
  );
}
