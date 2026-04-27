"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ReviewCard } from "./review-card";
import { formatCard } from "@/lib/import/preview-formatter";

interface ReviewListProps {
  entityKey: string;
  rows: Record<string, string>[];
  mapping: Record<string, string | null>;
  skipped: Set<number>;
  onToggleSkip: (rowNumber: number) => void;
}

const INITIAL_VISIBLE = 10;

export function ReviewList({
  entityKey,
  rows,
  mapping,
  skipped,
  onToggleSkip,
}: ReviewListProps) {
  const t = useTranslations("import");
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const ready = rows.length - skipped.size;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-label text-on-surface">{t("willCreate")}</h2>
        <p className="text-sm text-on-surface-variant">
          {t("readySkippedCounter", { ready, skipped: skipped.size })}
        </p>
      </div>
      <div className="space-y-2">
        {rows.slice(0, visible).map((row, idx) => {
          const rowNumber = idx + 2;
          const mapped: Record<string, string> = {};
          for (const [csvHeader, ourField] of Object.entries(mapping)) {
            if (ourField) mapped[ourField] = row[csvHeader] ?? "";
          }
          return (
            <ReviewCard
              key={rowNumber}
              rowNumber={rowNumber}
              card={formatCard(entityKey, mapped)}
              rawRow={row}
              skipped={skipped.has(rowNumber)}
              onToggleSkip={() => onToggleSkip(rowNumber)}
            />
          );
        })}
      </div>
      {visible < rows.length && (
        <Button
          variant="outline"
          onClick={() => setVisible((v) => v + INITIAL_VISIBLE)}
        >
          {t("showMore", { remaining: rows.length - visible })}
        </Button>
      )}
    </div>
  );
}
