import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

interface LegalLink {
  key: "privacy" | "terms" | "cookies" | "dpa";
  url: string | undefined;
}

export default async function LegalPage() {
  const links: LegalLink[] = [
    { key: "privacy", url: process.env.LEGAL_PRIVACY_URL },
    { key: "terms", url: process.env.LEGAL_TERMS_URL },
    { key: "cookies", url: process.env.LEGAL_COOKIES_URL },
    { key: "dpa", url: process.env.LEGAL_DPA_URL },
  ];

  const available = links.filter(
    (l): l is { key: LegalLink["key"]; url: string } => Boolean(l.url),
  );

  if (available.length === 0) notFound();

  const t = await getTranslations("legal");

  return (
    <main className="prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-6 py-12">
      <h1>{t("pageTitle")}</h1>
      <p>{t("intro")}</p>
      <ul>
        {available.map(({ key, url }) => (
          <li key={key}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {t(`links.${key}`)}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
