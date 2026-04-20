import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { countryIntegrationCredentials } from "@opentab/db/schema";
import { getCountryProvider } from "@/lib/country";
import { PageHeader } from "@/components/layout/page-header";
import { decryptConfig } from "@/lib/country/crypto";
import { GenericIntegrationSettingsForm } from "@/components/settings/generic-integration-settings-form";
import { introspectZodSchema } from "@/lib/country/schema-introspect";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function IntegrationSettingsPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const provider = getCountryProvider(session.org.countryCode);
  const integration = provider.integrations.find(
    (i) => i.settingsPage?.slug === slug || i.kind === slug,
  );
  if (!integration) notFound();

  const tNav = await getTranslations("nav");
  const tInt = await getTranslations("settingsIntegrations");

  const [cred] = await db
    .select()
    .from(countryIntegrationCredentials)
    .where(
      and(
        eq(countryIntegrationCredentials.orgId, session.org.id),
        eq(countryIntegrationCredentials.countryCode, provider.code),
        eq(countryIntegrationCredentials.kind, integration.kind),
      ),
    );

  if (integration.requiresCredentials === false) {
    return (
      <>
        <PageHeader
          headingPrefix={tInt("title")}
          heading={integration.label}
          userName={session.user.name}
          userEmail={session.user.email}
        />
        <main className="px-6 py-6">
          <div className="bg-surface-container rounded-xl p-6">
            <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">
              {integration.label}
            </h3>
            <p className="text-on-surface/60 text-sm">
              {integration.description ?? tInt("noCredentialsDescription")}
            </p>
          </div>
        </main>
      </>
    );
  }

  if (!integration.configSchema) {
    notFound();
  }

  const fields = introspectZodSchema(integration.configSchema);
  const publicFields = integration.publicFields ?? [];

  // Only send back public field values for editing — never surface decrypted
  // secrets to the browser. User must re-enter secrets to update them.
  const publicValues: Record<string, unknown> = {};
  if (cred) {
    const decrypted = decryptConfig<Record<string, unknown>>(
      cred.configJson as Record<string, unknown>,
      publicFields,
    );
    for (const key of publicFields) {
      publicValues[key] = decrypted[key];
    }
  }

  return (
    <>
      <PageHeader
        headingPrefix={tNav("settings")}
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
        <GenericIntegrationSettingsForm
          slug={slug}
          label={integration.label}
          fields={fields}
          publicFields={publicFields}
          publicValues={publicValues}
          hasCredentials={Boolean(cred)}
          lastValidatedAt={cred?.lastValidatedAt ?? null}
        />
      </main>
    </>
  );
}
