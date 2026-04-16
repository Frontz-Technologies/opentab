import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { getSession } from "@/lib/session";
import {
  getAiSettings,
  getAiEnvConfig,
  getModelCapabilities,
} from "@/lib/actions/ai-settings";

export default async function AiIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "owner" && session.role !== "admin") {
    redirect("/settings/integrations");
  }

  const t = await getTranslations("settingsAi");
  const tInt = await getTranslations("settingsIntegrations");
  const [settings, envConfig] = await Promise.all([
    getAiSettings(session.org.id),
    getAiEnvConfig(),
  ]);

  const model =
    envConfig?.model ?? settings?.model ?? "anthropic/claude-sonnet-4-5";
  const capabilities = await getModelCapabilities(model);

  return (
    <>
      <PageHeader
        headingPrefix={tInt("title")}
        heading={t("title")}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        <p className="mb-8 text-sm text-on-surface/60">{t("description")}</p>
        {envConfig ? (
          <div className="space-y-4 rounded-2xl border border-on-surface/10 bg-surface-container-low p-6">
            <div className="flex items-center gap-3 rounded-xl bg-primary/10 px-4 py-3">
              <span className="material-symbols-outlined text-primary text-[20px]">
                check_circle
              </span>
              <p className="text-sm text-primary font-medium">
                {t("configuredFromEnv")}
              </p>
            </div>
            <div className="space-y-3 text-sm text-on-surface/70">
              <div className="flex gap-2">
                <span className="font-medium text-on-surface min-w-[120px]">
                  {t("model")}:
                </span>
                <span className="font-mono">{envConfig.model}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-on-surface min-w-[120px]">
                  {t("apiKey")}:
                </span>
                <span className="font-mono">
                  sk-or-...{envConfig.apiKeyLast4}
                </span>
              </div>
            </div>
            <p className="text-xs text-on-surface/50">
              {t("configuredFromEnvHelp")}
            </p>
          </div>
        ) : (
          <AiSettingsForm
            orgId={session.org.id}
            initialData={
              settings ?? {
                enabled: false,
                model: "anthropic/claude-sonnet-4-5",
                apiKeyLast4: null,
                hasApiKey: false,
                receiptExtractionEnabled: true,
              }
            }
            initialCapabilities={capabilities}
          />
        )}
      </main>
    </>
  );
}
