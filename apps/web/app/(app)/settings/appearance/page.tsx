import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { AppearanceForm } from "./appearance-form";
import { getUserPreferences } from "@/lib/actions/user-preferences";

export default async function AppearanceSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsAppearance");
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
        <AppearanceForm
          initialData={{
            theme: prefs?.theme ?? "dark",
            density: prefs?.density ?? "comfortable",
          }}
        />
      </main>
    </>
  );
}
