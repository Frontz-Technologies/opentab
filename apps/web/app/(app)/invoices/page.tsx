import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { invoices } from "@opentab/db/schema";
import { eq, desc } from "drizzle-orm";
import { InvoiceList } from "./invoice-list";

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("invoices");

  const allInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.orgId, session.org.id))
    .orderBy(desc(invoices.createdAt));

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              add
            </span>
            {t("addInvoice")}
          </Link>
        }
      />
      <div className="px-6 py-6">
        <InvoiceList
          invoices={allInvoices}
          showMyData={session.org.countryCode === "GR"}
        />
      </div>
    </>
  );
}
