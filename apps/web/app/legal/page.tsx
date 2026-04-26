import { getTranslations } from "next-intl/server";

export default async function LegalPage() {
  const t = await getTranslations("legal");

  return (
    <main className="prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-6 py-12">
      <h1>{t("pageTitle")}</h1>
      <p className="text-muted-foreground text-sm">{t("lastUpdated")}</p>

      <section id="privacy">
        <h2>{t("privacy.title")}</h2>
        <p>{t("privacy.intro")}</p>
        <h3>What data we collect</h3>
        <p>{t("privacy.dataCollected")}</p>
        <h3>Where it&apos;s stored</h3>
        <p>{t("privacy.dataLocation")}</p>
        <h3>Retention</h3>
        <p>{t("privacy.retention")}</p>
        <h3>Your rights</h3>
        <p>{t("privacy.yourRights")}</p>
        <h3>Sub-processors</h3>
        <p>{t("privacy.thirdParties")}</p>
      </section>

      <section id="terms">
        <h2>{t("terms.title")}</h2>
        <p>{t("terms.intro")}</p>
        <h3>Beta notice</h3>
        <p>{t("terms.betaNotice")}</p>
        <h3>Your content</h3>
        <p>{t("terms.yourContent")}</p>
        <h3>Acceptable use</h3>
        <p>{t("terms.acceptableUse")}</p>
        <h3>Termination</h3>
        <p>{t("terms.termination")}</p>
        <h3>Jurisdiction</h3>
        <p>{t("terms.jurisdiction")}</p>
      </section>

      <section id="cookies">
        <h2>{t("cookies.title")}</h2>
        <p>{t("cookies.intro")}</p>
        <p>{t("cookies.list")}</p>
      </section>

      <section id="dpa">
        <h2>{t("dpa.title")}</h2>
        <p>{t("dpa.intro")}</p>
        <p>{t("dpa.summary")}</p>
        <p>{t("dpa.request")}</p>
      </section>

      <hr />
      <p>{t("contact")}</p>
    </main>
  );
}
