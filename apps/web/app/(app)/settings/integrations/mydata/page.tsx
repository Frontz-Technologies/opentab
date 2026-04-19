import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { MyDataSettingsForm } from "./mydata-settings-form";
import { getMyDataCredentialsStatus } from "./actions";

export default async function MyDataIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { getCountryProvider } = await import("@/lib/country");
  const provider = getCountryProvider(session.org.countryCode);
  if (!provider.integrations.some((i) => i.kind === "mydata")) {
    redirect("/settings/integrations");
  }

  const t = await getTranslations("integrations.mydata");
  const tInt = await getTranslations("settingsIntegrations");
  const credentials = await getMyDataCredentialsStatus();

  return (
    <>
      <PageHeader
        headingPrefix={tInt("title")}
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="px-6 py-6">
        <p className="text-on-surface/60 text-sm mb-8">{t("description")}</p>
        <MyDataSettingsForm credentials={credentials} />
      </main>
    </>
  );
}
