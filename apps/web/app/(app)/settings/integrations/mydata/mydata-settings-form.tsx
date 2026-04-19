"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  saveMyDataCredentials,
  testMyDataConnection,
  deleteMyDataCredentials,
} from "./actions";

interface CredentialStatus {
  id: string;
  aadeUserId: string;
  environment: string;
  isActive: boolean;
  lastValidatedAt: Date | null;
}

interface MyDataSettingsFormProps {
  credentials: CredentialStatus | null;
}

export function MyDataSettingsForm({ credentials }: MyDataSettingsFormProps) {
  const t = useTranslations("integrations.mydata");
  const tCommon = useTranslations("integrations.common");
  const [isPending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setTestResult(null);
      setFieldErrors({});
      const result = await saveMyDataCredentials(formData);
      // Fire toast directly rather than through a useEffect-based hook —
      // revalidatePath triggers a re-render that can cancel the effect
      // before it runs on the success path.
      if (result.success) {
        toast.success(t("saveSuccess"));
      } else if (result.error) {
        if (typeof result.error === "string") {
          toast.error(result.error);
        } else {
          setFieldErrors(result.error as Record<string, string[]>);
          const summary = Object.values(result.error).flat().join(". ");
          toast.error(summary || t("saveFailed"));
        }
      }
    });
  }

  function handleTest() {
    startTransition(async () => {
      const result = await testMyDataConnection();
      setTestResult(result);
      if (result.success) {
        toast.success(t("testSuccess"));
      } else {
        toast.error(
          t("testFailed", { error: result.error ?? "Unknown error" }),
        );
      }
    });
  }

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const result = await deleteMyDataCredentials();
      if (result.success) {
        toast.success(t("deleteSuccess"));
      } else if (result.error && typeof result.error === "string") {
        toast.error(result.error);
      }
    });
  }

  // Derived badge state: red if no credentials, amber if last test failed,
  // emerald if last test (or a save) succeeded.
  const badgeState: "connected" | "failing" | "notConnected" = !credentials
    ? "notConnected"
    : testResult && !testResult.success
      ? "failing"
      : "connected";

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline text-lg font-semibold text-on-surface">
              {t("connectionStatus")}
            </h3>
            {credentials?.lastValidatedAt && (
              <p className="text-on-surface/50 text-xs mt-1">
                {t("lastValidated")}:{" "}
                {new Date(credentials.lastValidatedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <Badge
            className={
              badgeState === "connected"
                ? "bg-primary text-on-primary"
                : badgeState === "failing"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-red-500/20 text-red-400"
            }
            variant="outline"
          >
            {badgeState === "connected"
              ? t("connected")
              : badgeState === "failing"
                ? t("connectionFailing")
                : t("notConnected")}
          </Badge>
        </div>
      </div>

      {/* Credentials Form */}
      <form
        action={handleSubmit}
        className="bg-surface-container rounded-xl p-6 space-y-4"
      >
        <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
          {t("credentials")}
        </h3>

        <div className="space-y-2">
          <Label htmlFor="aadeUserId">{t("aadeUserId")}</Label>
          <Input
            id="aadeUserId"
            name="aadeUserId"
            defaultValue={credentials?.aadeUserId ?? ""}
            placeholder={t("aadeUserIdPlaceholder")}
            required
            aria-invalid={fieldErrors.aadeUserId ? true : undefined}
          />
          {fieldErrors.aadeUserId && (
            <p className="text-xs text-red-400">
              {fieldErrors.aadeUserId.join(". ")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="subscriptionKey">{t("subscriptionKey")}</Label>
          <Input
            id="subscriptionKey"
            name="subscriptionKey"
            type="password"
            placeholder={
              credentials
                ? t("subscriptionKeyExisting")
                : t("subscriptionKeyPlaceholder")
            }
            required={!credentials}
            aria-invalid={fieldErrors.subscriptionKey ? true : undefined}
          />
          {fieldErrors.subscriptionKey && (
            <p className="text-xs text-red-400">
              {fieldErrors.subscriptionKey.join(". ")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="environment">{t("environment")}</Label>
          <select
            id="environment"
            name="environment"
            defaultValue={credentials?.environment ?? "sandbox"}
            className="flex h-9 w-full rounded-md border border-on-surface/10 bg-surface-container px-3 py-1 text-sm text-on-surface shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <option value="sandbox">{t("sandbox")}</option>
            <option value="production">{t("production")}</option>
          </select>
          <p className="text-on-surface/50 text-xs">{t("environmentHelp")}</p>
        </div>

        {testResult && (
          <div
            className={`rounded-lg p-3 text-sm ${
              testResult.success
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {testResult.success
              ? t("testSuccess")
              : t("testFailed", { error: testResult.error ?? "Unknown error" })}
          </div>
        )}

        <p className="text-on-surface/50 text-xs pt-2">
          {tCommon("decryptNotice")}
        </p>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {t("save")}
          </Button>
          {credentials && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={isPending}
              >
                {t("testConnection")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={isPending}
                className="text-red-400 hover:text-red-300"
              >
                {t("deleteCredentials")}
              </Button>
            </>
          )}
        </div>
      </form>

      {/* Info Card */}
      <div className="bg-surface-container rounded-xl p-6">
        <h3 className="font-headline text-lg font-semibold text-on-surface mb-2">
          {t("aboutTitle")}
        </h3>
        <p className="text-on-surface/60 text-sm">{t("aboutDescription")}</p>
        <a
          href="https://www.aade.gr/mydatapi"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          {t("aadePortalLink")} &rarr;
        </a>
      </div>
    </div>
  );
}
