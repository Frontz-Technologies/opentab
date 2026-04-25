import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { invoiceSequences } from "@/lib/entities/invoice-sequence";
import { PageHeader } from "@/components/layout/page-header";
import { NumberingForm } from "./numbering-form";

export default async function NumberingSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsNumbering");
  const tNav = await getTranslations("settingsNav");

  const [seq] = await db
    .select()
    .from(invoiceSequences)
    .where(
      and(
        eq(invoiceSequences.orgId, session.org.id),
        eq(invoiceSequences.type, "invoice"),
      ),
    );

  // Fall back to defaults when the org has never created an invoice
  // (no sequence row yet). All values match the schema defaults so
  // the form preview matches what generation would actually produce.
  const initial = {
    prefix: seq?.prefix ?? "INV-",
    digitCount: seq?.digitCount ?? 4,
    includeYear: seq?.includeYear ?? false,
    pattern: seq?.pattern ?? null,
    nextNumber: seq?.nextNumber ?? 1,
  };

  return (
    <>
      <PageHeader
        headingPrefix={tNav("sectionOrganisation")}
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="px-8 py-8 max-w-3xl mx-auto">
        <p className="text-sm text-on-surface-variant mb-6">
          {t("description")}
        </p>
        <NumberingForm initial={initial} />
      </main>
    </>
  );
}
