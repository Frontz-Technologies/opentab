import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import {
  invoices,
  countryIntegrationSubmissions,
  countryIntegrationCredentials,
} from "@opentab/db/schema";
import { eq, desc, count, and, inArray } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import { InvoiceList } from "./invoice-list";
import { Pagination } from "@/components/ui/pagination";
import {
  parsePage,
  paginationOffset,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("invoices");
  const params = await searchParams;
  const page = parsePage(params);

  const [allInvoices, [{ total }]] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(eq(invoices.orgId, session.org.id))
      .orderBy(desc(invoices.createdAt))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(paginationOffset(page)),
    db
      .select({ total: count() })
      .from(invoices)
      .where(eq(invoices.orgId, session.org.id)),
  ]);

  const provider = getCountryProvider(session.org.countryCode);
  const mydataIntegration = provider.integrations.find(
    (i) => i.kind === "mydata",
  );
  // The myDATA column only makes sense when the org has actually
  // connected its ΑΑΔΕ credentials — not just because the country
  // provider declares the integration. Otherwise the column renders
  // empty for every invoice and confuses the demo / pre-connect UX.
  const mydataConnected = mydataIntegration
    ? (
        await db
          .select({ id: countryIntegrationCredentials.id })
          .from(countryIntegrationCredentials)
          .where(
            and(
              eq(countryIntegrationCredentials.orgId, session.org.id),
              eq(countryIntegrationCredentials.countryCode, provider.code),
              eq(countryIntegrationCredentials.kind, "mydata"),
              eq(countryIntegrationCredentials.isActive, true),
            ),
          )
          .limit(1)
      ).length > 0
    : false;
  const mydataStatusByInvoice: Record<string, number | null> = {};
  if (mydataConnected && allInvoices.length > 0) {
    const submissions = await db
      .select({
        invoiceId: countryIntegrationSubmissions.invoiceId,
        status: countryIntegrationSubmissions.status,
        createdAt: countryIntegrationSubmissions.createdAt,
      })
      .from(countryIntegrationSubmissions)
      .where(
        and(
          eq(countryIntegrationSubmissions.orgId, session.org.id),
          eq(countryIntegrationSubmissions.countryCode, provider.code),
          eq(countryIntegrationSubmissions.kind, "mydata"),
          inArray(
            countryIntegrationSubmissions.invoiceId,
            allInvoices.map((i) => i.id),
          ),
        ),
      )
      .orderBy(desc(countryIntegrationSubmissions.createdAt));

    for (const s of submissions) {
      if (s.invoiceId && mydataStatusByInvoice[s.invoiceId] === undefined) {
        mydataStatusByInvoice[s.invoiceId] = s.status;
      }
    }
  }

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/import/invoices"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-on-surface/20 text-on-surface font-medium text-sm hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                upload
              </span>
              {t("import")}
            </Link>
            <Link
              href="/invoices/new"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                add
              </span>
              {t("addInvoice")}
            </Link>
          </div>
        }
      />
      <div className="px-6 py-6">
        <InvoiceList
          invoices={allInvoices}
          showMyData={mydataConnected}
          mydataStatusByInvoice={mydataStatusByInvoice}
        />
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
