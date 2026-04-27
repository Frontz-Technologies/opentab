"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CardShape } from "@/lib/import/preview-formatter";

interface ReviewCardProps {
  rowNumber: number;
  card: CardShape;
  rawRow: Record<string, string>;
  skipped: boolean;
  onToggleSkip: () => void;
}

export function ReviewCard({
  rowNumber,
  card,
  rawRow,
  skipped,
  onToggleSkip,
}: ReviewCardProps) {
  const t = useTranslations("import");
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      data-slot="review-card"
      className={cn(
        "bg-surface-container-lowest rounded-xl p-4 transition-opacity",
        skipped && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-xs font-mono text-on-surface/40 mt-1">
          #{rowNumber}
        </span>
        <div className="flex-1 min-w-0">
          <p
            data-slot="review-card-primary"
            className={cn(
              "font-medium text-on-surface truncate",
              skipped && "line-through",
            )}
          >
            {card.primary}
          </p>
          {card.secondary.length > 0 && (
            <p
              className={cn(
                "text-sm text-on-surface-variant truncate",
                skipped && "line-through",
              )}
            >
              {card.secondary.join(" · ")}
            </p>
          )}
        </div>
        <Switch
          checked={!skipped}
          onCheckedChange={onToggleSkip}
          aria-label={t("skipRow")}
        />
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-xs text-on-surface/60 hover:text-on-surface"
      >
        {expanded ? t("hideRawRow") : t("viewRawRow")}
      </button>
      {expanded && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
          {Object.entries(rawRow).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-on-surface/60">{k}</dt>
              <dd className="text-on-surface truncate">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
