"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface DoneSummaryProps {
  result: {
    created: number;
    skippedDup: number;
    skippedByUser: number;
    failed: number;
    errorCsv: string | null;
  };
  entityKey: string;
  onDownloadErrors: () => void;
  onDone: () => void;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-4">
      <p className="text-xs text-on-surface/60 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-3xl font-headline font-bold text-on-surface mt-1">
        {value}
      </p>
    </div>
  );
}

export function DoneSummary({
  result,
  entityKey,
  onDownloadErrors,
  onDone,
}: DoneSummaryProps) {
  const t = useTranslations("import");
  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <span className="material-symbols-outlined text-5xl text-primary">
          check_circle
        </span>
        <h2 className="font-headline text-2xl font-bold text-on-surface">
          {t("importComplete")}
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("created")} value={result.created} />
        <StatCard label={t("skippedDup")} value={result.skippedDup} />
        <StatCard label={t("skippedByUser")} value={result.skippedByUser} />
        <StatCard label={t("failed")} value={result.failed} />
      </div>
      <div className="flex gap-3 justify-end">
        {result.failed > 0 && result.errorCsv && (
          <Button variant="outline" onClick={onDownloadErrors}>
            {t("downloadErrorCsv", { count: result.failed })}
          </Button>
        )}
        <Button onClick={onDone}>
          {t("goToEntity", { entity: entityKey })}
        </Button>
      </div>
    </div>
  );
}
