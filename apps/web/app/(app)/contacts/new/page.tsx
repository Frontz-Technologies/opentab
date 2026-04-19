import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { getCountryProvider } from "@/lib/country";
import { db } from "@/lib/db";
import { contacts } from "@opentab/db/schema";
import { eq, desc } from "drizzle-orm";
import { ContactForm } from "./contact-form";

export default async function NewContactPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("contacts");
  const provider = getCountryProvider(session.org.countryCode);

  const recentContacts = await db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      email: contacts.email,
    })
    .from(contacts)
    .where(eq(contacts.orgId, session.org.id))
    .orderBy(desc(contacts.createdAt))
    .limit(3);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="font-headline text-3xl font-bold text-on-surface mb-6">
        {t("addContact")}
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <ContactForm
            capabilities={provider.capabilities}
            taxOffices={provider.taxOffices}
            vatRates={provider.vatRates}
          />
        </div>
        <aside className="space-y-6 lg:pt-2">
          <div className="bg-surface-container-low rounded-2xl p-6">
            <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-3">
              {t("tipsHeading")}
            </p>
            <ul className="space-y-2.5 text-sm text-on-surface">
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">
                  check
                </span>
                <span>{t("tipVat")}</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">
                  check
                </span>
                <span>{t("tipEmail")}</span>
              </li>
              <li className="flex gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">
                  check
                </span>
                <span>{t("tipAddress")}</span>
              </li>
            </ul>
          </div>

          {recentContacts.length > 0 && (
            <div className="bg-surface-container-low rounded-2xl p-6">
              <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-3">
                {t("recentHeading")}
              </p>
              <ul className="space-y-1 mb-3">
                {recentContacts.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/contacts/${c.id}`}
                      className="flex flex-col rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-container transition-colors"
                    >
                      <span className="text-sm text-on-surface truncate">
                        {c.displayName}
                      </span>
                      {c.email && (
                        <span className="text-xs text-on-surface-variant truncate">
                          {c.email}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/contacts"
                className="inline-flex items-center gap-1 text-xs font-label uppercase tracking-widest text-primary hover:underline"
              >
                {t("viewAll")}
                <span className="material-symbols-outlined text-[14px]">
                  arrow_forward
                </span>
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
