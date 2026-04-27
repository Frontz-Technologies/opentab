"use client";

import { useEffect, useReducer, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  cleanupImport,
  commitImport,
  getSampleCsv,
  getAiSuggestions,
  uploadImportCsv,
} from "./actions";
import { buildSamplesByHeader } from "@/lib/import/core/ai-match";
import { WizardStepper } from "@/components/import/wizard-stepper";
import { UploadDropzone } from "@/components/import/upload-dropzone";
import {
  MappingPanel,
  type AiSuggestion,
} from "@/components/import/mapping-panel";
import { ReviewList } from "@/components/import/review-list";
import { DoneSummary } from "@/components/import/done-summary";

interface WizardProps {
  entityKey: string;
  entityLabel: string;
  fields: Array<{ name: string; required: boolean }>;
}

type Step = "upload" | "review" | "done";

interface State {
  step: Step;
  parsing: boolean;
  parsed: {
    importId: string;
    headers: string[];
    rowCount: number;
    sample: Record<string, string>[];
  } | null;
  mapping: Record<string, string | null>;
  skipped: Set<number>;
  autoCreateContact: boolean;
  aiLoading: boolean;
  aiSuggestions: AiSuggestion[];
  result: {
    created: number;
    skippedDup: number;
    skippedByUser: number;
    failed: number;
    errorCsv: string | null;
  } | null;
}

type Action =
  | { type: "PARSING" }
  | { type: "PARSED"; parsed: State["parsed"]; mapping: State["mapping"] }
  | { type: "PARSE_ERROR" }
  | { type: "MAP"; mapping: State["mapping"] }
  | { type: "TOGGLE_SKIP"; rowNumber: number }
  | { type: "TOGGLE_AUTO_CREATE_CONTACT"; value: boolean }
  | { type: "AI_LOADING"; loading: boolean }
  | { type: "AI_SUGGESTIONS"; suggestions: AiSuggestion[] }
  | { type: "RESULT"; result: State["result"] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PARSING":
      return { ...state, parsing: true };
    case "PARSED":
      return {
        ...state,
        parsing: false,
        parsed: action.parsed,
        mapping: action.mapping,
        step: "review",
      };
    case "PARSE_ERROR":
      return {
        ...state,
        parsing: false,
        parsed: null,
        mapping: {},
        skipped: new Set<number>(),
        aiSuggestions: [],
      };
    case "MAP":
      return { ...state, mapping: action.mapping };
    case "TOGGLE_SKIP": {
      const next = new Set(state.skipped);
      if (next.has(action.rowNumber)) next.delete(action.rowNumber);
      else next.add(action.rowNumber);
      return { ...state, skipped: next };
    }
    case "TOGGLE_AUTO_CREATE_CONTACT":
      return { ...state, autoCreateContact: action.value };
    case "AI_LOADING":
      return { ...state, aiLoading: action.loading };
    case "AI_SUGGESTIONS": {
      // Auto-applied suggestions merge into the mapping, but only where the
      // user hasn't already mapped that header (manual override always wins).
      const next = { ...state.mapping };
      for (const s of action.suggestions) {
        if (s.autoApply && !next[s.theirHeader]) {
          next[s.theirHeader] = s.ourField;
        }
      }
      return { ...state, aiSuggestions: action.suggestions, mapping: next };
    }
    case "RESULT":
      return { ...state, result: action.result, step: "done" };
  }
}

export function ImportWizard({ entityKey, entityLabel, fields }: WizardProps) {
  const t = useTranslations("import");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(reducer, {
    step: "upload" as Step,
    parsing: false,
    parsed: null,
    mapping: {},
    skipped: new Set<number>(),
    autoCreateContact: true,
    aiLoading: false,
    aiSuggestions: [],
    result: null,
  } satisfies State);

  useEffect(() => {
    const importId = state.parsed?.importId;
    if (!importId) return;
    // Once the wizard reaches "done", the server already deleted the
    // file on commit success — no cleanup needed from this side.
    if (state.step === "done") return;

    const onUnload = () => {
      navigator.sendBeacon(
        "/api/import/cleanup",
        new Blob([JSON.stringify({ importId })], {
          type: "application/json",
        }),
      );
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void cleanupImport({ importId });
    };
  }, [state.parsed?.importId, state.step]);

  async function handleFile(file: File) {
    dispatch({ type: "PARSING" });
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadImportCsv(formData);
      if (!result.ok) {
        toast.error(result.error);
        dispatch({ type: "PARSE_ERROR" });
        return;
      }

      const { autoMap } = await import("@/lib/import/core/mapper");
      const { getImporter } = await import("@/lib/import/importers");
      const importer = getImporter(entityKey);
      const mapping = autoMap(result.parsed.headers, importer.aliases);
      dispatch({ type: "PARSED", parsed: result.parsed, mapping });

      const unmapped = result.parsed.headers.filter((h) => !mapping[h]);
      if (unmapped.length > 0) {
        dispatch({ type: "AI_LOADING", loading: true });
        const samplesByHeader = buildSamplesByHeader(
          result.parsed.sample,
          unmapped,
        );
        getAiSuggestions(entityKey, {
          unmappedHeaders: unmapped,
          samplesByHeader,
        })
          .then((suggestions) => {
            dispatch({ type: "AI_SUGGESTIONS", suggestions });
          })
          .finally(() => {
            dispatch({ type: "AI_LOADING", loading: false });
          });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      dispatch({ type: "PARSE_ERROR" });
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
        importId: state.parsed!.importId,
        mapping: state.mapping,
        skippedByUser: Array.from(state.skipped),
        autoCreateToggles: { contact: state.autoCreateContact },
      });
      dispatch({ type: "RESULT", result });
    });
  }

  function downloadErrorCsv() {
    if (!state.result?.errorCsv) return;
    const blob = new Blob([state.result.errorCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          {t("heading", { entity: entityLabel })}
        </h1>
        <WizardStepper
          steps={[
            { id: "upload", label: t("step.upload") },
            { id: "review", label: t("step.review") },
            { id: "done", label: t("step.done") },
          ]}
          currentId={state.step}
        />
      </div>

      {state.step === "upload" && (
        <UploadDropzone
          parsing={state.parsing}
          onFile={handleFile}
          onDownloadSample={handleSampleDownload}
        />
      )}

      {state.step === "review" && state.parsed && (
        <div className="flex flex-col md:flex-row gap-6">
          <MappingPanel
            headers={state.parsed.headers}
            fields={fields}
            mapping={state.mapping}
            onChange={(m) => dispatch({ type: "MAP", mapping: m })}
            showAutoCreateContact={
              entityKey === "invoices" || entityKey === "credit-notes"
            }
            autoCreateContact={state.autoCreateContact}
            onAutoCreateContactChange={(v) =>
              dispatch({ type: "TOGGLE_AUTO_CREATE_CONTACT", value: v })
            }
            onContinue={handleCommit}
            aiLoading={state.aiLoading}
            aiSuggestions={state.aiSuggestions}
          />
          <div className="flex-1 min-w-0">
            <ReviewList
              entityKey={entityKey}
              rows={state.parsed.sample}
              mapping={state.mapping}
              skipped={state.skipped}
              onToggleSkip={(rn) =>
                dispatch({ type: "TOGGLE_SKIP", rowNumber: rn })
              }
            />
          </div>
        </div>
      )}

      {state.step === "review" && isPending && (
        <div className="text-sm text-on-surface-variant">{t("committing")}</div>
      )}

      {state.step === "done" && state.result && (
        <DoneSummary
          result={state.result}
          entityKey={entityKey}
          onDownloadErrors={downloadErrorCsv}
          onDone={() => router.push(`/${entityKey}`)}
        />
      )}
    </div>
  );
}
