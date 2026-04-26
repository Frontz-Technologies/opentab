// Better Auth's trustedOrigins is a CSRF allow-list — every redirectTo /
// callbackURL passed to the API is rejected with 403 "Invalid redirectURL"
// unless its origin is in here. Driving it from a single env var means a
// missing or misformatted env (trailing slash, unset entirely) takes auth
// down hard, so this helper combines:
//
//   1. The origin the request came in on — under our single-tenant cloud,
//      anything reaching the API is necessarily coming through the public
//      domain, so trusting that origin is safe and self-correcting.
//   2. Any of NEXT_PUBLIC_APP_URL / APP_URL / BETTER_AUTH_URL that happen
//      to be set, with trailing slashes stripped.
//
// Order doesn't matter; Better Auth treats the array as a set of allowed
// origins.
const ENV_KEYS = ["NEXT_PUBLIC_APP_URL", "APP_URL", "BETTER_AUTH_URL"] as const;

export function deriveTrustedOrigins(request?: Request): string[] {
  const origins = new Set<string>();

  if (request) {
    try {
      const url = new URL(request.url);
      origins.add(`${url.protocol}//${url.host}`);
    } catch {
      // Unparseable request URL — fall through to env-only origins.
    }
  }

  for (const key of ENV_KEYS) {
    const value = process.env[key];
    if (value) origins.add(value.replace(/\/$/, ""));
  }

  return [...origins];
}
