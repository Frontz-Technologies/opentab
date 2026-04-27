"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  parsing: boolean;
  onFile: (file: File) => void;
  onDownloadSample: () => void;
}

export function UploadDropzone({
  parsing,
  onFile,
  onDownloadSample,
}: UploadDropzoneProps) {
  const t = useTranslations("import");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-on-surface/20 bg-surface-container-low",
          parsing && "pointer-events-none opacity-60",
        )}
      >
        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined animate-spin text-3xl text-primary">
              progress_activity
            </span>
            <p className="text-on-surface-variant">{t("parsing")}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-on-surface/40">
              upload_file
            </span>
            <p className="text-on-surface font-medium">{t("dropPrompt")}</p>
            <p className="text-on-surface-variant text-sm">
              {t("dropSubprompt")}
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>
      <div className="flex justify-center">
        <Button variant="outline" onClick={onDownloadSample}>
          {t("downloadSample")}
        </Button>
      </div>
    </div>
  );
}
