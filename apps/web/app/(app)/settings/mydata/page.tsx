import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { MyDataSettingsForm } from "./mydata-settings-form";
import { getMyDataCredentialsStatus } from "./actions";

export default async function MyDataSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Only Greek orgs should access this page
  if (session.org.countryCode !== "GR") {
    redirect("/settings/company");
  }

  const t = await getTranslations("mydata");
  const credentials = await getMyDataCredentialsStatus();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("settings"), href: "/settings/company" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="px-8 py-8 max-w-3xl mx-auto">
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t("title")}
        </h2>
        <p className="text-on-surface/60 text-sm mb-8">{t("description")}</p>
        <MyDataSettingsForm credentials={credentials} />
      </main>
    </>
  );
}
