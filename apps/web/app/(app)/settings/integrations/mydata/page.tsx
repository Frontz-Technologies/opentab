import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { MyDataSettingsForm } from "./mydata-settings-form";
import { getMyDataCredentialsStatus } from "./actions";
import Link from "next/link";

export default async function MyDataIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.org.countryCode !== "GR") {
    redirect("/settings/integrations");
  }

  const t = await getTranslations("mydata");
  const tInt = await getTranslations("settingsIntegrations");
  const credentials = await getMyDataCredentialsStatus();

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: tInt("title"), href: "/settings/integrations" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors mb-6"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          {tInt("backToIntegrations")}
        </Link>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          {t("title")}
        </h2>
        <p className="text-on-surface/60 text-sm mb-8">{t("description")}</p>
        <MyDataSettingsForm credentials={credentials} />
      </main>
    </>
  );
}
