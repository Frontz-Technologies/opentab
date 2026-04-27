"use client";

// Root-level App Router error boundary. ONLY renders when the root
// layout itself crashes, or for routes that don't have a closer
// `error.tsx`. Pages inside the `(app)` group are caught one level
// deeper by `app/(app)/error.tsx` first; that boundary handles the
// `Sentry.captureException` and prevents the error from cascading
// here. Don't double-instrument from the (app) boundary.
//
// Copy is hardcoded English by design: this file fires in the worst
// possible app state (root layout crashed). Loading next-intl from
// here is itself fragile, so we render a static fallback. The
// follow-up to localise this should pass the locale via a cookie or
// query param and use a small inline dictionary, not next-intl.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      extra: { digest: error.digest ?? null },
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="text-on-surface-variant">
            We&apos;ve been notified. Please try again, or reload the page if
            this keeps happening.
          </p>
          <button
            type="button"
            onClick={reset}
            className="bg-primary text-on-primary rounded-xl px-5 py-2 font-medium"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
