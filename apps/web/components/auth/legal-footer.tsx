// Server component. Renders the "Terms · Privacy" line at the foot of
// auth screens IF the operator has configured at least one of the
// LEGAL_*_URL env vars. Returns null when nothing is configured so
// self-hosters who haven't deployed legal pages don't get dead links
// that 404.
//
// Reads server-side env vars (LEGAL_TERMS_URL, LEGAL_PRIVACY_URL) so
// they don't need to be exposed via NEXT_PUBLIC_* and don't get baked
// into the client bundle at build time.

import { getTranslations } from "next-intl/server";

export async function LegalFooter() {
  const termsUrl = process.env.LEGAL_TERMS_URL;
  const privacyUrl = process.env.LEGAL_PRIVACY_URL;

  if (!termsUrl && !privacyUrl) return null;

  const t = await getTranslations("auth");

  return (
    <p className="mt-4 text-center text-on-surface-variant/60 text-xs">
      {termsUrl && (
        <a
          href={termsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-on-surface-variant transition-colors"
        >
          {t("terms")}
        </a>
      )}
      {termsUrl && privacyUrl && " · "}
      {privacyUrl && (
        <a
          href={privacyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-on-surface-variant transition-colors"
        >
          {t("privacy")}
        </a>
      )}
    </p>
  );
}
