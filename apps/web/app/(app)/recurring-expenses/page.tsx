import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { recurringExpenses } from "@opentab/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { RecurringExpenseList } from "./recurring-expense-list";
import { Pagination } from "@/components/ui/pagination";
import {
  parsePage,
  paginationOffset,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";

export default async function RecurringExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("recurringExpenses");
  const params = await searchParams;
  const page = parsePage(params);

  const [allRecurring, [{ total }]] = await Promise.all([
    db
      .select()
      .from(recurringExpenses)
      .where(eq(recurringExpenses.orgId, session.org.id))
      .orderBy(desc(recurringExpenses.createdAt))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(paginationOffset(page)),
    db
      .select({ total: count() })
      .from(recurringExpenses)
      .where(eq(recurringExpenses.orgId, session.org.id)),
  ]);

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <Link
            href="/recurring-expenses/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
          >
            <Plus className="h-[18px] w-[18px]" />
            {t("addRecurring")}
          </Link>
        }
      />
      <div className="px-6 py-6">
        <RecurringExpenseList items={allRecurring} />
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
