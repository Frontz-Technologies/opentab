import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { getSession } from "@/lib/session";
import { getActiveFxProvider } from "@/lib/fx/registry";

export default async function FxProviderSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsFx");
  const tInt = await getTranslations("settingsIntegrations");
  const provider = getActiveFxProvider();

  return (
    <>
      <PageHeader
        headingPrefix={tInt("title")}
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <div className="max-w-2xl">
          <div className="bg-surface-container-low rounded-xl p-6">
            <span className="font-medium">{provider.displayName}</span>
          </div>
        </div>
      </main>
    </>
  );
}
