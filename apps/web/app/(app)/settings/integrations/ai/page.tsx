import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { getSession } from "@/lib/session";
import { getAiSettings, getModelCapabilities } from "@/lib/actions/ai-settings";

export default async function AiIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "owner" && session.role !== "admin") {
    redirect("/settings/integrations");
  }

  const t = await getTranslations("settingsAi");
  const tInt = await getTranslations("settingsIntegrations");
  const settings = await getAiSettings(session.org.id);

  // Capabilities are checked against the extraction model since that's
  // the surface that needs vision/file capability detection (receipt
  // OCR). Skip the lookup when no extraction model is configured.
  const extractionModel =
    process.env.AI_MODEL_EXTRACTION ?? settings?.extractionModel ?? null;
  const capabilities = extractionModel
    ? await getModelCapabilities(extractionModel)
    : null;

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
        <AiSettingsForm
          orgId={session.org.id}
          initialData={
            settings ?? {
              enabled: false,
              chatModel: null,
              extractionModel: null,
              apiKeyLast4: null,
              hasApiKey: false,
              receiptExtractionEnabled: true,
              apiKeyOverriddenByEnv: Boolean(process.env.OPENROUTER_API_KEY),
              chatModelOverriddenByEnv: Boolean(process.env.AI_MODEL_CHAT),
              extractionModelOverriddenByEnv: Boolean(
                process.env.AI_MODEL_EXTRACTION,
              ),
            }
          }
          initialCapabilities={capabilities}
        />
      </main>
    </>
  );
}
