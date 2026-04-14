import { getSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { PnlClient } from "./pnl-client";

export default async function PnlPage() {
  const session = (await getSession())!;
  const t = await getTranslations("reports");
  const tNav = await getTranslations("nav");

  // Default to current month
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  return (
    <>
      <PageHeader
        headingPrefix={tNav("reports")}
        heading={t("pnl")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="px-8 py-8 max-w-7xl mx-auto">
        <PnlClient defaultStart={startDate} defaultEnd={endDate} />
      </main>
    </>
  );
}
