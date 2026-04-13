import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TopBar } from "@/components/layout/top-bar";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { getSession } from "@/lib/session";
import { getAiSettings } from "@/lib/actions/ai-settings";

export default async function AiSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "owner" && session.role !== "admin") {
    redirect("/settings/company");
  }

  const t = await getTranslations("settingsAi");
  const settings = await getAiSettings(session.org.id);

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("settings"), href: "/settings/company" },
          { label: t("title") },
        ]}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main className="mx-auto max-w-3xl px-8 py-8">
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
