import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { recurringInvoices } from "@opentab/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { RecurringList } from "./recurring-list";
import { Pagination } from "@/components/ui/pagination";
import {
  parsePage,
  paginationOffset,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("recurring");
  const params = await searchParams;
  const page = parsePage(params);

  const [allRecurring, [{ total }]] = await Promise.all([
    db
      .select()
      .from(recurringInvoices)
      .where(eq(recurringInvoices.orgId, session.org.id))
      .orderBy(desc(recurringInvoices.createdAt))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(paginationOffset(page)),
    db
      .select({ total: count() })
      .from(recurringInvoices)
      .where(eq(recurringInvoices.orgId, session.org.id)),
  ]);

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <Link
            href="/recurring/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
          >
            <Plus className="h-[18px] w-[18px]" />
            {t("addRecurring")}
          </Link>
        }
      />
      <div className="px-6 py-6">
        <RecurringList items={allRecurring} />
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
