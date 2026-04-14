import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TopBar } from "@/components/layout/top-bar";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { getSession } from "@/lib/session";
import { getAiSettings } from "@/lib/actions/ai-settings";
import Link from "next/link";

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
        <h2 className="mb-2 font-headline text-3xl font-extrabold tracking-tight text-on-surface">
          {t("title")}
        </h2>
        <p className="mb-8 text-sm text-on-surface/60">{t("description")}</p>
        <AiSettingsForm
          orgId={session.org.id}
          initialData={
            settings ?? {
              enabled: false,
              model: "anthropic/claude-sonnet-4",
              apiKeyLast4: null,
              hasApiKey: false,
            }
          }
        />
      </main>
    </>
  );
}
