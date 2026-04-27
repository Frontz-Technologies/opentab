"use client";

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
            We&apos;ve been notified. Please try again — or reload the page if
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
