import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { contacts } from "@opentab/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { ContactList } from "./contact-list";
import { Pagination } from "@/components/ui/pagination";
import {
  parsePage,
  paginationOffset,
  DEFAULT_PAGE_SIZE,
} from "@/lib/pagination";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("contacts");
  const params = await searchParams;
  const page = parsePage(params);

  const [allContacts, [{ total }]] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(eq(contacts.orgId, session.org.id))
      .orderBy(desc(contacts.createdAt))
      .limit(DEFAULT_PAGE_SIZE)
      .offset(paginationOffset(page)),
    db
      .select({ total: count() })
      .from(contacts)
      .where(eq(contacts.orgId, session.org.id)),
  ]);

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/import/contacts"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-on-surface/20 text-on-surface font-medium text-sm hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                upload
              </span>
              {t("import")}
            </Link>
            <Link
              href="/contacts/new"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                add
              </span>
              {t("addContact")}
            </Link>
          </div>
        }
      />
      <div className="px-6 py-6">
        <ContactList contacts={allContacts} />
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
