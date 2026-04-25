import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { contacts, invoices } from "@opentab/db/schema";
import { CreditNoteForm } from "./credit-note-form";

export default async function NewCreditNotePage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("creditNotes");

  const clientContacts = await db
    .select({
      id: contacts.id,
      displayName: contacts.displayName,
      email: contacts.email,
      vatNumber: contacts.vatNumber,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.orgId, session.org.id),
        inArray(contacts.type, ["client", "both"]),
      ),
    )
    .orderBy(desc(contacts.createdAt));

  // If invoiceId is supplied (from the "Issue Credit Note" entry path),
  // load the invoice + items to pre-fill the form.
  const params = await searchParams;
  let prefilledInvoice = null;
  if (params.invoiceId) {
    const [inv] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, params.invoiceId),
          eq(invoices.orgId, session.org.id),
        ),
      );
    prefilledInvoice = inv ?? null;
  }

  // No clients yet — render an empty state instead of a form whose
  // <select> has no options and whose submit would 500 on validation.
  // Mirrors the pattern /invoices/new uses.
  if (clientContacts.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-surface-container rounded-xl p-10 flex flex-col items-center text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
            person_add
          </span>
          <h1 className="font-headline text-xl font-semibold text-on-surface mb-2">
            {t("noContactsTitle")}
          </h1>
          <p className="text-on-surface-variant mb-6 max-w-md">
            {t("noContactsBody")}
          </p>
          <Link
            href="/contacts/new?return=/credit-notes/new"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("addFirstContact")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-headline text-2xl font-bold text-on-surface">
        {t("addCreditNote")}
      </h1>
      <CreditNoteForm
        contacts={clientContacts}
        defaultCurrency={session.org.defaultCurrency}
        prefilledInvoice={prefilledInvoice}
      />
    </div>
  );
}
