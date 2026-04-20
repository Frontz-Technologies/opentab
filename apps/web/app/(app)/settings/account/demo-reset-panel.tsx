"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resetDemoAction } from "./actions";

// "Reset demo" card for the account settings page. Only rendered when
// the caller's org is flagged isDemo (gated in page.tsx). The action
// itself re-checks the flag server-side, so a manipulated request
// can't wipe a real org.
export function DemoResetPanel() {
  const t = useTranslations("demo");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function handleReset() {
    setError(null);
    startTransition(async () => {
      const result = await resetDemoAction();
      if (!result.success) {
        setError(result.error ?? t("resetError"));
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div
      data-testid="demo-reset-panel"
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 mt-8"
    >
      <h3 className="font-headline text-lg font-semibold text-on-surface mb-1">
        {t("resetPanelTitle")}
      </h3>
      <p className="text-sm text-on-surface-variant mb-4">
        {t("resetPanelBody")}
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-tertiary-container/20 px-3 py-2 text-xs text-on-tertiary-container">
          {error}
        </div>
      )}

      {!confirming ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirming(true)}
          disabled={isPending}
        >
          {t("resetPanelAction")}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="bg-tertiary-container text-on-tertiary-container hover:bg-tertiary-container/90"
          >
            {isPending ? t("resetPanelLoading") : t("resetPanelConfirm")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirming(false)}
            disabled={isPending}
          >
            {t("resetPanelCancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
