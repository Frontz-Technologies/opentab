// Single source of truth for the operator-configured legal URLs that
// the login + register pages link to. Centralising here so:
//   1. Both `<LegalFooter />` and `register/page.tsx` read the same
//      values (the previous duplication risked diverging if a third
//      env name was ever added).
//   2. Each value is validated as a real http(s) URL before it ever
//      reaches an `<a href>`. An operator misconfiguration like
//      `LEGAL_TERMS_URL=javascript:alert(1)` is dropped silently
//      instead of becoming a stored-XSS vector — operator-trust is
//      already the boundary, but defence in depth is cheap here.

export interface LegalUrls {
  termsUrl: string | null;
  privacyUrl: string | null;
}

function safeHttpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getLegalUrls(): LegalUrls {
  return {
    termsUrl: safeHttpUrl(process.env.LEGAL_TERMS_URL),
    privacyUrl: safeHttpUrl(process.env.LEGAL_PRIVACY_URL),
  };
}
