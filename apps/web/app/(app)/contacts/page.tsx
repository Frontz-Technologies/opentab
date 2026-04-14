import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { db } from "@/lib/db";
import { contacts } from "@opentab/db/schema";
import { eq, desc } from "drizzle-orm";
import { ContactList } from "./contact-list";

export default async function ContactsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("contacts");

  const allContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.orgId, session.org.id))
    .orderBy(desc(contacts.createdAt));

  return (
    <>
      <PageHeader
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
        actions={
          <Link
            href="/contacts/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              add
            </span>
            {t("addContact")}
          </Link>
        }
      />
      <div className="px-6 py-6">
        <ContactList contacts={allContacts} />
      </div>
    </>
  );
}
