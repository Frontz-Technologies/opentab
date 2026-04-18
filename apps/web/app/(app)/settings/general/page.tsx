import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { GeneralForm } from "./general-form";
import { getUserPreferences } from "@/lib/actions/user-preferences";

export default async function GeneralSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsGeneral");
  const tNav = await getTranslations("nav");
  const prefs = await getUserPreferences();

  return (
    <>
      <PageHeader
        headingPrefix={tNav("settings")}
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <p className="text-sm text-on-surface/60 mb-8">{t("description")}</p>
        <GeneralForm
          initialData={{
            locale: prefs?.locale ?? "en",
            dateFormat: prefs?.dateFormat ?? "DD/MM/YYYY",
            numberFormat: prefs?.numberFormat ?? "eu",
            notifyInvoicePaid: prefs?.notifyInvoicePaid ?? true,
            notifyExpenseApproved: prefs?.notifyExpenseApproved ?? true,
          }}
        />
      </main>
    </>
  );
}
