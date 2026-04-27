"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface SectionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SectionError({ error, reset }: SectionErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      extra: { digest: error.digest ?? null, scope: "(app)/error" },
    });
  }, [error]);

  return (
    <div className="bg-surface-container-low rounded-2xl p-8 mx-auto max-w-2xl mt-12 text-center space-y-4">
      <h1 className="text-2xl font-headline font-bold">
        This page didn&apos;t load
      </h1>
      <p className="text-on-surface-variant">
        The error has been reported. Try this section again, or use the sidebar
        to go elsewhere while we look into it.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-on-primary rounded-xl px-5 py-2 font-medium"
      >
        Try again
      </button>
    </div>
  );
}
