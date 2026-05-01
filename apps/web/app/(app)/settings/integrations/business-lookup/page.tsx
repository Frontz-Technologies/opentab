import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { getSession } from "@/lib/session";
import { businessLookupSources } from "@/lib/business-lookup/registry";

export default async function BusinessLookupSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsBusinessLookup");
  const tInt = await getTranslations("settingsIntegrations");

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
            <p className="text-sm text-on-surface/60 mb-4">
              {t("cardDescription")}
            </p>
            <h3 className="font-medium mb-2">{t("activeSources")}</h3>
            <ul className="space-y-1 text-sm">
              {businessLookupSources.map((source) => (
                <li key={source.id} className="flex justify-between">
                  <span>{source.displayName}</span>
                  <span className="text-on-surface/50">{t("anonymous")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
