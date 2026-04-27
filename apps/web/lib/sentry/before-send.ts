// Filter Sentry events before they ship to GlitchTip. Drops noise from:
//   - /api/healthz polling (BetterStack + Coolify uptime checks)
//   - Next.js static-asset and image-optimisation requests
//   - Better Auth's deliberate "Invalid redirectURL/origin/callbackURL"
//     responses (those are enumeration-safe by design, not real errors)
//
// Pure function — instrumentation.ts wires this into Sentry.init.
// Kept testable by avoiding any direct dependency on the SDK.

import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const DROPPED_URL_FRAGMENTS = [
  "/api/healthz",
  "/_next/static/",
  "/_next/image",
];

const DROPPED_MESSAGE_FRAGMENTS = [
  "Invalid redirectURL",
  "Invalid origin",
  "Invalid callbackURL",
];

export function beforeSend(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  const url = event.request?.url ?? "";
  if (DROPPED_URL_FRAGMENTS.some((fragment) => url.includes(fragment))) {
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
