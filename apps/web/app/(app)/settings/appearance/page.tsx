import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { AppearanceForm } from "./appearance-form";
import { getUserPreferences } from "@/lib/actions/user-preferences";

export default async function AppearanceSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsAppearance");
  const prefs = await getUserPreferences();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t("title")}
        </h2>
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
