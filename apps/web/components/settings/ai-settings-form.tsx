"use client";

import { useState, useTransition, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Lock, XCircle } from "lucide-react";
import {
  updateAiSettings,
  testAiConnection,
  deleteApiKey,
  getModelCapabilities,
  type ModelCapabilities,
} from "@/lib/actions/ai-settings";
import { Button } from "@/components/ui/button";
import { FormCheckbox } from "@/components/ui/form-checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AiSettingsFormProps {
  orgId: string;
  initialData: {
    enabled: boolean;
    chatModel: string | null;
    extractionModel: string | null;
    apiKeyLast4: string | null;
    hasApiKey: boolean;
    receiptExtractionEnabled: boolean;
    apiKeyOverriddenByEnv: boolean;
    chatModelOverriddenByEnv: boolean;
    extractionModelOverriddenByEnv: boolean;
  };
  initialCapabilities?: ModelCapabilities | null;
}

function CapabilityBadge({
  label,
  supported,
}: {
  label: string;
  supported: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        supported
          ? "bg-primary-container/15 text-primary"
          : "bg-on-surface/5 text-on-surface/30"
      }`}
    >
      {supported ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}

function DeploymentPill({
  labelKey,
  helpKey,
}: {
  labelKey: "setByDeployment" | "apiKeySetByDeployment";
  helpKey: "setByDeploymentHelp";
}) {
  const t = useTranslations("settingsAi");
  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
        <Lock className="h-4 w-4" />
        {t(labelKey)}
      </div>
      <p className="text-xs text-on-surface/50">{t(helpKey)}</p>
    </div>
  );
}

export function AiSettingsForm({
  orgId,
  initialData,
  initialCapabilities,
}: AiSettingsFormProps) {
  const t = useTranslations("settingsAi");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<ModelCapabilities | null>(
    initialCapabilities ?? null,
  );
  const [isLoadingCaps, setIsLoadingCaps] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(initialData.enabled);
  const [receiptExtractionEnabled, setReceiptExtractionEnabled] =
    useState<boolean>(initialData.receiptExtractionEnabled);

  const fetchCapabilities = useCallback((model: string) => {
    if (!model.trim()) return;
    setIsLoadingCaps(true);
    getModelCapabilities(model.trim()).then((caps) => {
      setCapabilities(caps);
      setIsLoadingCaps(false);
    });
  }, []);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateAiSettings({
        enabled: formData.get("enabled") === "on",
        chatModel: (formData.get("chatModel") as string | null) || null,
        extractionModel:
          (formData.get("extractionModel") as string | null) || null,
        apiKey: formData.get("apiKey") ?? "",
        receiptExtractionEnabled:
          formData.get("receiptExtractionEnabled") === "on",
      });

      if (result.success) {
        setStatus(t("saved"));
      } else {
        const errObj = result.error as Record<string, string[]> | undefined;
        const msg = errObj?._ ? errObj._[0] : t("saveFailed");
        setStatus(msg);
      }
    });
  }

  function handleTest() {
    startTransition(async () => {
      const result = await testAiConnection(orgId);
      setStatus(
        result.success ? t("testSuccess") : (result.error ?? t("testFailed")),
      );
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteApiKey(orgId);
      setStatus(t("deleted"));
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-on-surface/10 bg-surface-container-low p-6"
    >
      <div className="space-y-2">
        <Label
          htmlFor="enabled"
          className="text-sm font-medium text-on-surface"
        >
          {t("enabled")}
        </Label>
        <label
          htmlFor="enabled"
          className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface"
        >
          <FormCheckbox
            id="enabled"
            name="enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          {t("enabledHelp")}
        </label>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-on-surface">
          {t("chatSection")}
        </h3>
        {initialData.chatModelOverriddenByEnv ? (
          <DeploymentPill
            labelKey="setByDeployment"
            helpKey="setByDeploymentHelp"
          />
        ) : (
          <div className="space-y-2">
            <Label
              htmlFor="chatModel"
              className="text-sm font-medium text-on-surface"
            >
              {t("chatModelLabel")}
            </Label>
            <Input
              id="chatModel"
              name="chatModel"
              defaultValue={initialData.chatModel ?? ""}
              placeholder="openai/gpt-4o-mini"
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-on-surface">
          {t("extractionSection")}
        </h3>
        {initialData.extractionModelOverriddenByEnv ? (
          <DeploymentPill
            labelKey="setByDeployment"
            helpKey="setByDeploymentHelp"
          />
        ) : (
          <div className="space-y-2">
            <Label
              htmlFor="extractionModel"
              className="text-sm font-medium text-on-surface"
            >
              {t("extractionModelLabel")}
            </Label>
            <Input
              id="extractionModel"
              name="extractionModel"
              defaultValue={initialData.extractionModel ?? ""}
              placeholder="openai/gpt-4o"
              onBlur={(e) => fetchCapabilities(e.target.value)}
            />
            <div className="flex items-center gap-2 min-h-[24px]">
              {isLoadingCaps ? (
                <span className="text-xs text-on-surface/40">
                  {t("checkingCapabilities")}
                </span>
              ) : capabilities ? (
                <>
                  <CapabilityBadge label="Text" supported={capabilities.text} />
                  <CapabilityBadge
                    label="Image"
                    supported={capabilities.image}
                  />
                  <CapabilityBadge label="File" supported={capabilities.file} />
                </>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {initialData.apiKeyOverriddenByEnv ? (
        <DeploymentPill
          labelKey="apiKeySetByDeployment"
          helpKey="setByDeploymentHelp"
        />
      ) : (
        <div className="space-y-2">
          <Label
            htmlFor="apiKey"
            className="text-sm font-medium text-on-surface"
          >
            {t("apiKey")}
          </Label>
          <Input
            id="apiKey"
            name="apiKey"
            type="password"
            placeholder={
              initialData.hasApiKey
                ? t("apiKeyStored", {
                    last4: initialData.apiKeyLast4 ?? "----",
                  })
                : t("apiKeyPlaceholder")
            }
          />
        </div>
      )}

      <div className="space-y-2">
        <Label
          htmlFor="receiptExtractionEnabled"
          className="text-sm font-medium text-on-surface"
        >
          {t("receiptExtraction")}
        </Label>
        <label
          htmlFor="receiptExtractionEnabled"
          className="flex items-center gap-3 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface"
        >
          <FormCheckbox
            id="receiptExtractionEnabled"
            name="receiptExtractionEnabled"
            checked={receiptExtractionEnabled}
            onCheckedChange={setReceiptExtractionEnabled}
          />
          {t("receiptExtractionHelp")}
        </label>
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
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleTest}
        >
          {t("test")}
        </Button>
        {initialData.hasApiKey && !initialData.apiKeyOverriddenByEnv && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleDelete}
          >
            {t("delete")}
          </Button>
        )}
      </div>
    </form>
  );
}
