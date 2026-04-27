"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IntrospectedField } from "@/lib/country/schema-introspect";
import {
  saveIntegrationCredentials,
  testIntegrationConnection,
  deleteIntegrationCredentials,
} from "@/app/(app)/settings/integrations/[slug]/actions";

interface Props {
  slug: string;
  label: string;
  fields: IntrospectedField[];
  publicFields: string[];
  publicValues: Record<string, unknown>;
  hasCredentials: boolean;
  lastValidatedAt: Date | null;
}

function humanise(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function EnumField({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: string[];
  defaultValue: string;
}) {
  const [value, setValue] = useState<string>(defaultValue);
  return (
    <>
      <Select value={value} onValueChange={(v) => setValue(v)}>
        <SelectTrigger id={name} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </>
  );
}

export function GenericIntegrationSettingsForm({
  slug,
  label,
  fields,
  publicFields,
  publicValues,
  hasCredentials,
  lastValidatedAt,
}: Props) {
  const t = useTranslations("integrations.common");
  const [isPending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const publicSet = new Set(publicFields);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setTestResult(null);
      setFieldErrors({});
      const result = await saveIntegrationCredentials(slug, formData);
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
      const result = (await testIntegrationConnection(slug)) as {
        success: boolean;
        error?: string;
      };
      setTestResult(result);
      if (result.success) {
        toast.success(t("testSuccess"));
      } else {
        toast.error(
          t("testFailed", { error: result.error ?? t("unknownError") }),
        );
      }
    });
  }

  function handleDelete() {
    if (!confirm(t("deleteConfirm", { label }))) return;
    startTransition(async () => {
      const result = await deleteIntegrationCredentials(slug);
      if (result.success) {
        toast.success(t("deleteSuccess"));
      } else if (result.error && typeof result.error === "string") {
        toast.error(result.error);
      }
    });
  }

  const badgeState: "connected" | "failing" | "notConnected" = !hasCredentials
    ? "notConnected"
    : testResult && !testResult.success
      ? "failing"
      : "connected";

  return (
    <div className="space-y-6">
      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline text-lg font-semibold text-on-surface">
              {t("connectionStatus")}
            </h3>
            {lastValidatedAt && (
              <p className="text-on-surface/50 text-xs mt-1">
                {t("lastValidated")}:{" "}
                {new Date(lastValidatedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <Badge
            className={
              badgeState === "connected"
                ? "bg-primary text-on-primary"
                : badgeState === "failing"
                  ? "bg-warning/15 text-warning"
                  : "bg-tertiary-container/20 text-tertiary"
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

      <form
        action={handleSubmit}
        className="bg-surface-container rounded-xl p-6 space-y-4"
      >
        <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
          {t("credentials")}
        </h3>

        {fields.map((field) => {
          const isPublic = publicSet.has(field.name);
          const labelText = humanise(field.name);
          const existingValue = publicValues[field.name];

          if (field.kind === "enum" && field.options) {
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{labelText}</Label>
                <EnumField
                  name={field.name}
                  options={field.options}
                  defaultValue={
                    typeof existingValue === "string"
                      ? existingValue
                      : field.options[0]
                  }
                />
              </div>
            );
          }

          if (field.kind === "boolean") {
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{labelText}</Label>
                <input
                  type="checkbox"
                  id={field.name}
                  name={field.name}
                  defaultChecked={existingValue === true}
                  value="true"
                />
              </div>
            );
          }

          const isSecret = !isPublic;
          return (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{labelText}</Label>
              <Input
                id={field.name}
                name={field.name}
                type={isSecret ? "password" : "text"}
                defaultValue={
                  !isSecret && typeof existingValue === "string"
                    ? existingValue
                    : ""
                }
                placeholder={
                  isSecret && hasCredentials
                    ? t("secretPlaceholder")
                    : undefined
                }
                required={field.required && !(isSecret && hasCredentials)}
                inputMode={field.kind === "number" ? "numeric" : undefined}
                aria-invalid={fieldErrors[field.name] ? true : undefined}
              />
              {fieldErrors[field.name] && (
                <p className="text-xs text-error">
                  {fieldErrors[field.name].join(". ")}
                </p>
              )}
            </div>
          );
        })}

        {testResult && (
          <div
            className={`rounded-lg p-3 text-sm ${
              testResult.success
                ? "bg-primary-container/15 text-primary"
                : "bg-error/10 text-error"
            }`}
          >
            {testResult.success
              ? t("testSuccess")
              : t("testFailed", {
                  error: testResult.error ?? t("unknownError"),
                })}
          </div>
        )}

        <p className="text-on-surface/50 text-xs pt-2">{t("decryptNotice")}</p>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {t("save")}
          </Button>
          {hasCredentials && (
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
                className="text-tertiary hover:text-tertiary/80"
              >
                {t("delete")}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
