"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateAiSettings, testAiConnection, deleteApiKey } from "@/lib/actions/ai-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AiSettingsFormProps {
  orgId: string;
  initialData: {
    enabled: boolean;
    model: string;
    apiKeyLast4: string | null;
    hasApiKey: boolean;
  };
}

export function AiSettingsForm({ orgId, initialData }: AiSettingsFormProps) {
  const t = useTranslations("settingsAi");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateAiSettings({
        enabled: formData.get("enabled") === "on",
        model: formData.get("model"),
        apiKey: formData.get("apiKey"),
      });

      setStatus(result.success ? t("saved") : t("saveFailed"));
    });
  }

  function handleTest() {
    startTransition(async () => {
      const result = await testAiConnection(orgId);
      setStatus(result.success ? t("testSuccess") : result.error ?? t("testFailed"));
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteApiKey(orgId);
      setStatus(t("deleted"));
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6 rounded-2xl border border-on-surface/10 bg-surface-container-low p-6">
      <div className="space-y-2">
        <Label htmlFor="enabled" className="text-sm font-medium text-on-surface">
          {t("enabled")}
        </Label>
        <label className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface">
          <input id="enabled" name="enabled" type="checkbox" defaultChecked={initialData.enabled} />
          {t("enabledHelp")}
        </label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model" className="text-sm font-medium text-on-surface">
          {t("model")}
        </Label>
        <Input id="model" name="model" defaultValue={initialData.model} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey" className="text-sm font-medium text-on-surface">
          {t("apiKey")}
        </Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          placeholder={
            initialData.hasApiKey
              ? t("apiKeyStored", { last4: initialData.apiKeyLast4 ?? "----" })
              : t("apiKeyPlaceholder")
          }
        />
      </div>

      {status && (
        <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
          {status}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending}>
          {t("save")}
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={handleTest}>
          {t("test")}
        </Button>
        {initialData.hasApiKey && (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleDelete}>
            {t("delete")}
          </Button>
        )}
      </div>
    </form>
  );
}
