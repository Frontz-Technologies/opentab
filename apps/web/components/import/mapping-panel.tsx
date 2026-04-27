"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MappingField {
  name: string;
  required: boolean;
}

export interface AiSuggestion {
  ourField: string;
  theirHeader: string;
  confidence: number;
  reason?: string;
  autoApply: boolean;
}

interface MappingPanelProps {
  headers: string[];
  fields: MappingField[];
  mapping: Record<string, string | null>;
  onChange: (mapping: Record<string, string | null>) => void;
  showAutoCreateContact: boolean;
  autoCreateContact: boolean;
  onAutoCreateContactChange: (v: boolean) => void;
  onContinue: () => void;
  aiLoading?: boolean;
  aiSuggestions?: AiSuggestion[];
}

export function MappingPanel({
  headers,
  fields,
  mapping,
  onChange,
  showAutoCreateContact,
  autoCreateContact,
  onAutoCreateContactChange,
  onContinue,
  aiLoading,
  aiSuggestions,
}: MappingPanelProps) {
  const t = useTranslations("import");
  const [open, setOpen] = useState(true);
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const requiredFieldNames = fields
    .filter((f) => f.required)
    .map((f) => f.name);
  const mappedFieldNames = new Set(
    Object.values(mapping).filter(Boolean) as string[],
  );
  const missingRequired = requiredFieldNames.filter(
    (n) => !mappedFieldNames.has(n),
  );
  const continueDisabled = missingRequired.length > 0;

  const suggestionByHeader = new Map(
    (aiSuggestions ?? []).map((s) => [s.theirHeader, s] as const),
  );

  function setOne(header: string, value: string | null) {
    onChange({ ...mapping, [header]: value });
  }

  return (
    <div className="md:sticky md:top-4 md:self-start md:w-[360px] space-y-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="md:hidden flex items-center justify-between w-full bg-surface-container rounded-xl p-4 text-left">
          <span className="font-label text-on-surface">
            {t("mappedCounter", { mapped: mappedCount, total: headers.length })}
          </span>
          <span className="material-symbols-outlined text-on-surface/60">
            {open ? "expand_less" : "expand_more"}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="md:!block">
          <div className="bg-surface-container rounded-xl p-4 space-y-3">
            <div className="hidden md:flex items-baseline justify-between">
              <h2 className="font-label text-on-surface">
                {t("mappingHeading")}
              </h2>
              <span className="text-sm text-on-surface-variant">
                {t("mappedCounter", {
                  mapped: mappedCount,
                  total: headers.length,
                })}
              </span>
            </div>

            {aiLoading && (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-base">
                  progress_activity
                </span>
                {t("ai.lookingForMatches")}
              </div>
            )}

            {missingRequired.length > 0 && (
              <p className="text-xs text-error">
                {t("requiredMissing", { fields: missingRequired.join(", ") })}
              </p>
            )}

            <ul className="space-y-2">
              {headers.map((h) => {
                const suggestion = suggestionByHeader.get(h);
                const value = mapping[h] ?? "";
                return (
                  <li key={h} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-on-surface w-1/3 truncate">
                      {h}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <Select
                        value={value}
                        onValueChange={(v) => setOne(h, v || null)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t("skip")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">{t("skip")}</SelectItem>
                          {fields.map((f) => (
                            <SelectItem key={f.name} value={f.name}>
                              {f.name}
                              {f.required ? " *" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {suggestion &&
                        suggestion.autoApply &&
                        value === suggestion.ourField && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full bg-primary/15 text-primary"
                            title={suggestion.reason}
                          >
                            {t("ai.autoMatched")}
                          </span>
                        )}
                      {suggestion && !suggestion.autoApply && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full bg-warning/15 text-warning"
                          title={suggestion.reason}
                        >
                          {t("ai.suggests")}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {showAutoCreateContact && (
              <label
                className={cn(
                  "flex items-center justify-between gap-3 pt-2 border-t border-on-surface/10",
                )}
              >
                <span className="text-sm text-on-surface">
                  {t("autoCreateContactToggle")}
                </span>
                <Switch
                  checked={autoCreateContact}
                  onCheckedChange={onAutoCreateContactChange}
                />
              </label>
            )}

            <Button
              onClick={onContinue}
              disabled={continueDisabled}
              className="w-full"
            >
              {t("continueToReview")}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
