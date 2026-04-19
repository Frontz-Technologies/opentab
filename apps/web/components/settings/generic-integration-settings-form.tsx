"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useActionToast } from "@/components/ui/action-toast";
import type { IntrospectedField } from "@/lib/country/schema-introspect";
import {
  saveIntegrationCredentials,
  testIntegrationConnection,
  deleteIntegrationCredentials,
} from "@/app/(app)/settings/integrations/[slug]/actions";

type ActionResult = {
  success: boolean;
  error?: string | Record<string, string[]>;
} | null;

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

export function GenericIntegrationSettingsForm({
  slug,
  label,
  fields,
  publicFields,
  publicValues,
  hasCredentials,
  lastValidatedAt,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [saveResult, setSaveResult] = useState<ActionResult>(null);
  const [deleteResult, setDeleteResult] = useState<ActionResult>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useActionToast(saveResult, "Credentials saved");
  useActionToast(deleteResult, "Credentials deleted");

  const publicSet = new Set(publicFields);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setTestResult(null);
      setFieldErrors({});
      const result = await saveIntegrationCredentials(slug, formData);
      setSaveResult(result as ActionResult);
      if (
        result &&
        !result.success &&
        result.error &&
        typeof result.error !== "string"
      ) {
        setFieldErrors(result.error as Record<string, string[]>);
      }
    });
  }

  function handleTest() {
    startTransition(async () => {
      const result = await testIntegrationConnection(slug);
      setTestResult(result as { success: boolean; error?: string });
    });
  }

  function handleDelete() {
    if (
      !confirm(`Delete ${label} credentials? Pending transmissions will fail.`)
    )
      return;
    startTransition(async () => {
      const result = await deleteIntegrationCredentials(slug);
      setDeleteResult(result);
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline text-lg font-semibold text-on-surface">
              Connection Status
            </h3>
            {lastValidatedAt && (
              <p className="text-on-surface/50 text-xs mt-1">
                Last validated: {new Date(lastValidatedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <Badge
            className={
              hasCredentials
                ? "bg-primary text-on-primary"
                : "bg-red-500/20 text-red-400"
            }
            variant="outline"
          >
            {hasCredentials ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </div>

      <form
        action={handleSubmit}
        className="bg-surface-container rounded-xl p-6 space-y-4"
      >
        <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
          Credentials
        </h3>

        {fields.map((field) => {
          const isPublic = publicSet.has(field.name);
          const labelText = humanise(field.name);
          const existingValue = publicValues[field.name];

          if (field.kind === "enum" && field.options) {
            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{labelText}</Label>
                <select
                  id={field.name}
                  name={field.name}
                  defaultValue={
                    typeof existingValue === "string"
                      ? existingValue
                      : field.options[0]
                  }
                  className="flex h-9 w-full rounded-md border border-on-surface/10 bg-surface-container px-3 py-1 text-sm text-on-surface shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
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
                    ? "Enter new value to update"
                    : undefined
                }
                required={field.required && !(isSecret && hasCredentials)}
                inputMode={field.kind === "number" ? "numeric" : undefined}
                aria-invalid={fieldErrors[field.name] ? true : undefined}
              />
              {fieldErrors[field.name] && (
                <p className="text-xs text-red-400">
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
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {testResult.success
              ? "Connection successful"
              : `Connection failed: ${testResult.error ?? "Unknown error"}`}
          </div>
        )}

        <p className="text-on-surface/50 text-xs pt-2">
          opentab decrypts your credentials at submit time to call the tax
          authority on your behalf. Self-hosted installs keep everything
          in-process.
        </p>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            Save
          </Button>
          {hasCredentials && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={isPending}
              >
                Test Connection
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={isPending}
                className="text-red-400 hover:text-red-300"
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
