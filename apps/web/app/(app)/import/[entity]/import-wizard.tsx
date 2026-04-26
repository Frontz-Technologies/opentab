"use client";

import { useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { commitImport, getSampleCsv } from "./actions";

interface WizardProps {
  entityKey: string;
  entityLabel: string;
  fields: Array<{ name: string; required: boolean }>;
}

type Step = "upload" | "map" | "preview" | "commit";

interface State {
  step: Step;
  parsed: { headers: string[]; rows: Record<string, string>[] } | null;
  mapping: Record<string, string | null>;
  skipped: Set<number>;
  autoCreateContact: boolean;
  result: {
    created: number;
    skippedDup: number;
    skippedByUser: number;
    failed: number;
    errorCsv: string | null;
  } | null;
}

type Action =
  | { type: "PARSED"; parsed: State["parsed"]; mapping: State["mapping"] }
  | { type: "MAP"; mapping: State["mapping"] }
  | { type: "TOGGLE_SKIP"; rowNumber: number }
  | { type: "TOGGLE_AUTO_CREATE_CONTACT"; value: boolean }
  | { type: "RESULT"; result: State["result"] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PARSED":
      return {
        ...state,
        parsed: action.parsed,
        mapping: action.mapping,
        step: "map",
      };
    case "MAP":
      return { ...state, mapping: action.mapping, step: "preview" };
    case "TOGGLE_SKIP": {
      const next = new Set(state.skipped);
      if (next.has(action.rowNumber)) next.delete(action.rowNumber);
      else next.add(action.rowNumber);
      return { ...state, skipped: next };
    }
    case "TOGGLE_AUTO_CREATE_CONTACT":
      return { ...state, autoCreateContact: action.value };
    case "RESULT":
      return { ...state, result: action.result, step: "commit" };
  }
}

export function ImportWizard({ entityKey, entityLabel, fields }: WizardProps) {
  const t = useTranslations("import");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(reducer, {
    step: "upload" as Step,
    parsed: null,
    mapping: {},
    skipped: new Set<number>(),
    autoCreateContact: true, // v1.1 default ON, #220
    result: null,
  } satisfies State);

  async function handleFile(file: File) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { parseCsv } = await import("@/lib/import/core/parser");
    const { autoMap } = await import("@/lib/import/core/mapper");
    const { getImporter } = await import("@/lib/import/importers");
    try {
      const parsed = await parseCsv(buffer);
      const importer = getImporter(entityKey);
      const mapping = autoMap(parsed.headers, importer.aliases);
      dispatch({ type: "PARSED", parsed, mapping });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("parseError"));
    }
  }

  async function handleSampleDownload() {
    const csv = await getSampleCsv(entityKey);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entityKey}-sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCommit() {
    if (!state.parsed) return;
    startTransition(async () => {
      const result = await commitImport({
        entityKey,
        rows: state.parsed!.rows,
        mapping: state.mapping,
        skippedByUser: Array.from(state.skipped),
        autoCreateToggles: { contact: state.autoCreateContact },
      });
      dispatch({ type: "RESULT", result });
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-headline text-2xl font-bold">
        {t("heading", { entity: entityLabel })}
      </h1>

      {state.step === "upload" && (
        <div className="bg-surface-container rounded-xl p-6 space-y-4">
          <p className="text-on-surface-variant">{t("uploadHelp")}</p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button variant="outline" onClick={handleSampleDownload}>
            {t("downloadSample")}
          </Button>
        </div>
      )}

      {state.step === "map" && state.parsed && (
        <MapStep
          headers={state.parsed.headers}
          mapping={state.mapping}
          fields={fields}
          showAutoCreateContact={
            entityKey === "invoices" || entityKey === "credit-notes"
          }
          autoCreateContact={state.autoCreateContact}
          onAutoCreateContactChange={(v) =>
            dispatch({ type: "TOGGLE_AUTO_CREATE_CONTACT", value: v })
          }
          onContinue={(m) => dispatch({ type: "MAP", mapping: m })}
        />
      )}

      {state.step === "preview" && state.parsed && (
        <PreviewStep
          parsed={state.parsed}
          mapping={state.mapping}
          skipped={state.skipped}
          onToggleSkip={(rn) =>
            dispatch({ type: "TOGGLE_SKIP", rowNumber: rn })
          }
          onCommit={handleCommit}
          isPending={isPending}
        />
      )}

      {state.step === "commit" && state.result && (
        <CommitStep
          result={state.result}
          onDone={() => router.push(`/${entityKey}`)}
        />
      )}
    </div>
  );
}

function MapStep({
  headers,
  mapping,
  fields,
  showAutoCreateContact,
  autoCreateContact,
  onAutoCreateContactChange,
  onContinue,
}: {
  headers: string[];
  mapping: Record<string, string | null>;
  fields: Array<{ name: string; required: boolean }>;
  showAutoCreateContact: boolean;
  autoCreateContact: boolean;
  onAutoCreateContactChange: (v: boolean) => void;
  onContinue: (m: Record<string, string | null>) => void;
}) {
  const t = useTranslations("import");
  const [m, setM] = useState(mapping);
  const requiredCovered = fields
    .filter((f) => f.required)
    .every((f) => Object.values(m).includes(f.name));

  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-4">
      <h2 className="font-label text-on-surface">{t("mapHeading")}</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left py-2 font-label text-sm text-on-surface/60">
              {t("yourColumn")}
            </th>
            <th className="text-left py-2 font-label text-sm text-on-surface/60">
              {t("mapsTo")}
            </th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h) => (
            <tr key={h}>
              <td className="py-2 font-mono text-sm">{h}</td>
              <td>
                <label htmlFor={`map-${h}`} className="sr-only">
                  {t("mapsTo")}
                </label>
                <select
                  id={`map-${h}`}
                  className="bg-surface-container-lowest text-on-surface rounded-lg px-3 h-10"
                  value={m[h] ?? ""}
                  onChange={(e) => setM({ ...m, [h]: e.target.value || null })}
                >
                  <option value="">{t("skip")}</option>
                  {fields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                      {f.required ? " *" : ""}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showAutoCreateContact && (
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={autoCreateContact}
            onChange={(e) => onAutoCreateContactChange(e.target.checked)}
          />
          <span>{t("autoCreateContactToggle")}</span>
        </label>
      )}
      <Button onClick={() => onContinue(m)} disabled={!requiredCovered}>
        {t("continueToPreview")}
      </Button>
    </div>
  );
}

function PreviewStep({
  parsed,
  mapping,
  skipped,
  onToggleSkip,
  onCommit,
  isPending,
}: {
  parsed: { headers: string[]; rows: Record<string, string>[] };
  mapping: Record<string, string | null>;
  skipped: Set<number>;
  onToggleSkip: (rn: number) => void;
  onCommit: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("import");
  const previewRows = parsed.rows.slice(0, 50);
  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-4 overflow-x-auto">
      <h2 className="font-label text-on-surface">
        {t("previewHeading", { count: parsed.rows.length })}
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">#</th>
            <th className="text-left">{t("skip")}</th>
            {parsed.headers.map((h) => (
              <th
                key={h}
                className="text-left px-2 font-label text-on-surface/60"
              >
                {h}
                <div className="text-xs text-on-surface-variant">
                  → {mapping[h] ?? "—"}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, idx) => {
            const rowNumber = idx + 2;
            return (
              <tr key={rowNumber}>
                <td className="px-2 py-1 text-on-surface/60">{rowNumber}</td>
                <td className="px-2">
                  <input
                    type="checkbox"
                    checked={skipped.has(rowNumber)}
                    onChange={() => onToggleSkip(rowNumber)}
                    aria-label={t("skip")}
                  />
                </td>
                {parsed.headers.map((h) => (
                  <td key={h} className="px-2 py-1 text-on-surface">
                    {row[h]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button onClick={onCommit} disabled={isPending}>
        {t("commit")}
      </Button>
    </div>
  );
}

function CommitStep({
  result,
  onDone,
}: {
  result: NonNullable<State["result"]>;
  onDone: () => void;
}) {
  const t = useTranslations("import");
  function downloadErrorCsv() {
    if (!result.errorCsv) return;
    const blob = new Blob([result.errorCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="bg-surface-container rounded-xl p-6 space-y-4">
      <h2 className="font-label text-on-surface">{t("done")}</h2>
      <ul className="space-y-1">
        <li>
          {t("created")}: <strong>{result.created}</strong>
        </li>
        <li>
          {t("skippedDup")}: <strong>{result.skippedDup}</strong>
        </li>
        <li>
          {t("skippedByUser")}: <strong>{result.skippedByUser}</strong>
        </li>
        <li>
          {t("failed")}: <strong>{result.failed}</strong>
        </li>
      </ul>
      {result.errorCsv && (
        <Button variant="outline" onClick={downloadErrorCsv}>
          {t("downloadErrorCsv")}
        </Button>
      )}
      <Button onClick={onDone}>{t("done")}</Button>
    </div>
  );
}
