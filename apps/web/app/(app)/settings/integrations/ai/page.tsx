import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { getSession } from "@/lib/session";
import { getAiSettings } from "@/lib/actions/ai-settings";

export default async function AiIntegrationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "owner" && session.role !== "admin") {
    redirect("/settings/integrations");
  }

  const t = await getTranslations("settingsAi");
  const tInt = await getTranslations("settingsIntegrations");
  const settings = await getAiSettings(session.org.id);

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
              model: "anthropic/claude-sonnet-4",
              apiKeyLast4: null,
              hasApiKey: false,
              receiptExtractionEnabled: true,
            }
          }
        />
      </main>
    </>
  );
}
