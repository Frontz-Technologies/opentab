import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { IntegrationCard } from "@/components/settings/integration-card";
import { db } from "@/lib/db";
import { countryIntegrationCredentials } from "@opentab/db/schema";
import { and, eq } from "drizzle-orm";
import { getCountryProvider } from "@/lib/country";
import { getAiSettings } from "@/lib/actions/ai-settings";

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settingsIntegrations");
  const tNav = await getTranslations("nav");
  const isOwnerOrAdmin = session.role === "owner" || session.role === "admin";

  const provider = getCountryProvider(session.org.countryCode);
  const configurableIntegrations = provider.integrations.filter(
    (i) => i.settingsPage,
  );

  const credentialRows =
    configurableIntegrations.length > 0
      ? await db
          .select({
            kind: countryIntegrationCredentials.kind,
            isActive: countryIntegrationCredentials.isActive,
          })
          .from(countryIntegrationCredentials)
          .where(
            and(
              eq(countryIntegrationCredentials.orgId, session.org.id),
              eq(countryIntegrationCredentials.countryCode, provider.code),
            ),
          )
      : [];
  const configuredByKind = new Set(
    credentialRows.filter((r) => r.isActive).map((r) => r.kind),
  );

  const aiSettings = isOwnerOrAdmin
    ? await getAiSettings(session.org.id)
    : null;
  // The card shows "connected" when the deployment env supplies a key
  // (any feature gets a usable secret) or the per-org row is enabled.
  const aiKeyFromEnv =
    isOwnerOrAdmin && Boolean(process.env.OPENROUTER_API_KEY);

  const statusLabels = {
    connected: t("connected"),
    notConfigured: t("notConfigured"),
  };

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
        <div className="space-y-3">
          {configurableIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.kind}
              icon="cloud_sync"
              name={integration.label}
              description={integration.description ?? ""}
              href={`/settings/integrations/${integration.settingsPage!.slug}`}
              status={
                configuredByKind.has(integration.kind)
                  ? "connected"
                  : "not_configured"
              }
              statusLabels={statusLabels}
            />
          ))}
          {isOwnerOrAdmin && (
            <IntegrationCard
              icon="smart_toy"
              name={t("aiName")}
              description={t("aiDescription")}
              href="/settings/integrations/ai"
              status={
                aiKeyFromEnv || aiSettings?.enabled
                  ? "connected"
                  : "not_configured"
              }
              statusLabels={statusLabels}
            />
          )}
        </div>
      </main>
    </>
  );
}
