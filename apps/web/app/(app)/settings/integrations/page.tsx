import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { TopBar } from "@/components/layout/top-bar";
import { IntegrationCard } from "@/components/settings/integration-card";
import { getMyDataCredentialsStatus } from "./mydata/actions";
import { getAiSettings } from "@/lib/actions/ai-settings";

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsIntegrations");
  const isGreek = session.org.countryCode === "GR";
  const isOwnerOrAdmin = session.role === "owner" || session.role === "admin";

  const [mydataCredentials, aiSettings] = await Promise.all([
    isGreek ? getMyDataCredentialsStatus() : null,
    isOwnerOrAdmin ? getAiSettings(session.org.id) : null,
  ]);

  const statusLabels = {
    connected: t("connected"),
    notConfigured: t("notConfigured"),
  };

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
        <div className="space-y-3">
          {isGreek && (
            <IntegrationCard
              icon="cloud_sync"
              name={t("mydataName")}
              description={t("mydataDescription")}
              href="/settings/integrations/mydata"
              status={mydataCredentials ? "connected" : "not_configured"}
              statusLabels={statusLabels}
            />
          )}
          {isOwnerOrAdmin && (
            <IntegrationCard
              icon="smart_toy"
              name={t("aiName")}
              description={t("aiDescription")}
              href="/settings/integrations/ai"
              status={aiSettings?.enabled ? "connected" : "not_configured"}
              statusLabels={statusLabels}
            />
          )}
        </div>
      </main>
    </>
  );
}
