import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { getCountryProvider } from "@/lib/country";
import { PageHeader } from "@/components/layout/page-header";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function IntegrationDashboardPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const provider = getCountryProvider(session.org.countryCode);
  const integration = provider.integrations.find(
    (i) => i.settingsPage?.slug === slug || i.kind === slug,
  );
  if (!integration) notFound();
  if (!integration.dashboardModule) notFound();

  const tNav = await getTranslations("nav");

  return (
    <>
      <PageHeader
        headingPrefix={tNav("integrations")}
        heading={integration.label}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <main>
        {integration.description && (
          <p className="text-on-surface/60 text-sm mb-8">
            {integration.description}
          </p>
        )}
        <div className="bg-surface-container rounded-xl p-6">
          <p className="text-on-surface/60 text-sm">
            {integration.label} dashboard — detailed outbound / inbound / sync
            views ship in a follow-up. Manage credentials at{" "}
            <a
              href={`/settings/integrations/${slug}`}
              className="text-primary hover:text-primary/80"
            >
              /settings/integrations/{slug}
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
