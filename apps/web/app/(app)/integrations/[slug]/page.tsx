import { notFound, redirect } from "next/navigation";
import Link from "next/link";
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
      <main className="px-6 py-6">
        {integration.description && (
          <p className="text-on-surface/60 text-sm mb-8">
            {integration.description}
          </p>
        )}
        <div className="bg-surface-container rounded-xl px-6 py-16 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant mb-4">
            <span className="material-symbols-outlined text-[24px]">
              insights
            </span>
          </div>
          <h2 className="font-headline text-lg font-semibold text-on-surface mb-2">
            Dashboard coming soon
          </h2>
          <p className="text-on-surface/60 text-sm max-w-md mb-6">
            Outbound, inbound, and sync views for {integration.label} ship in a
            follow-up. In the meantime, configure credentials to start
            submitting.
          </p>
          <Link
            href={`/settings/integrations/${slug}`}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/80 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              key
            </span>
            Manage credentials
          </Link>
        </div>
      </main>
    </>
  );
}
