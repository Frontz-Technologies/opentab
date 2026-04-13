import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { recurringInvoices } from "@opentab/db/schema";
import { eq, desc } from "drizzle-orm";
import { RecurringList } from "./recurring-list";

export default async function RecurringPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("recurring");

  const allRecurring = await db
    .select()
    .from(recurringInvoices)
    .where(eq(recurringInvoices.orgId, session.org.id))
    .orderBy(desc(recurringInvoices.createdAt));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          {t("title")}
        </h1>
        <Link
          href="/recurring/new"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/80 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">
            add
          </span>
          {t("addRecurring")}
        </Link>
      </div>
      <RecurringList items={allRecurring} />
    </div>
  );
}
