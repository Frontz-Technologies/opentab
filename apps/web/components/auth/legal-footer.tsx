// Server component. Renders the "Terms · Privacy" line at the foot of
// auth screens IF the operator has configured at least one of the
// LEGAL_*_URL env vars. Returns null when nothing is configured so
// self-hosters who haven't deployed legal pages don't get dead links
// that 404.
//
// URLs come from `getLegalUrls()` (lib/config/legal.ts), which reads
// server-side env vars and validates them as http(s) — non-conforming
// values (e.g. an accidentally-pasted `javascript:` URL) get dropped
// before they ever land in an `<a href>`.

import { getTranslations } from "next-intl/server";
import { getLegalUrls } from "@/lib/config/legal";

export async function LegalFooter() {
  const { termsUrl, privacyUrl } = getLegalUrls();

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
