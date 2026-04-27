// Filter Sentry events before they ship to GlitchTip. Drops noise from:
//   - /api/healthz polling (BetterStack + Coolify uptime checks)
//   - Next.js static-asset and image-optimisation requests
//   - Better Auth's deliberate "Invalid redirectURL/origin/callbackURL"
//     responses (those are enumeration-safe by design, not real errors)
//
// Pure function — instrumentation.ts wires this into Sentry.init.
// Kept testable by avoiding any direct dependency on the SDK.

import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// Path-prefix matches. We compare against the URL's PATHNAME (parsed
// out below), not the raw URL string, so a path like "/foo/api/healthz"
// would not falsely match the "/api/healthz" prefix. The existing match
// list contains real path prefixes only — no query/fragment contents.
const DROPPED_PATH_PREFIXES = [
  "/api/healthz",
  "/_next/static/",
  "/_next/image",
];

const DROPPED_MESSAGE_FRAGMENTS = [
  "Invalid redirectURL",
  "Invalid origin",
  "Invalid callbackURL",
];

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    // Sentry sometimes records request.url as a path-only string when
    // the runtime can't resolve a base. Fall back to the raw value.
    return url;
  }
}

export function beforeSend(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  const rawUrl = event.request?.url ?? "";
  const pathname = pathnameOf(rawUrl);
  if (
    DROPPED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return null;
  }

  const message =
    hint.originalException instanceof Error
      ? hint.originalException.message
      : String(hint.originalException ?? "");
  if (
    DROPPED_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment))
  ) {
    return null;
  }

  return event;
}
