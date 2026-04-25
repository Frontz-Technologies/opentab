import { redirect } from "next/navigation";
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
