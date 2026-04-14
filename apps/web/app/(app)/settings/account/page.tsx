import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { AccountForm } from "./account-form";

export default async function AccountSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsAccount");

  return (
    <>
      <PageHeader
        headingPrefix="Settings"
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <p className="text-sm text-on-surface/60 mb-8">{t("description")}</p>
        <AccountForm
          initialData={{
            name: session.user.name,
            email: session.user.email,
          }}
        />
      </main>
    </>
  );
}
