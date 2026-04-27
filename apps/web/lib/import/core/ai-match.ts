import { generateObject } from "ai";
import { z } from "zod";
import { isFeatureEnabled, getFeatureModel } from "@/lib/ai/features";
import { createAiProvider } from "@/lib/ai/provider";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("import:ai-match");

const AUTO_APPLY_THRESHOLD = 0.85;
const SUGGESTION_THRESHOLD = 0.5;
const MAX_SAMPLE_CHARS = 32;
const MAX_SAMPLES_PER_COLUMN = 3;

export interface AiSuggestion {
  ourField: string;
  theirHeader: string;
  confidence: number;
  reason?: string;
  autoApply: boolean;
}

export interface AiMatchInput {
  apiKey: string;
  entityKey: string;
  fields: { name: string; required: boolean }[];
  unmappedHeaders: string[];
  // Pre-trimmed by the client: ≤ MAX_SAMPLES_PER_COLUMN entries per
  // header, each ≤ MAX_SAMPLE_CHARS. Computing this client-side keeps
  // the React Server Action payload small even for 50k-row CSVs.
  samplesByHeader: Record<string, string[]>;
}

const matchSchema = z.object({
  matches: z.array(
    z.object({
      ourField: z.string(),
      theirHeader: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string().max(80).optional(),
    }),
  ),
});

// Client-side helper. Used by the wizard before invoking the server
// action so the action only ever receives a few KB of samples instead
// of the full CSV.
export function buildSamplesByHeader(
  rows: Record<string, string>[],
  headers: string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const header of headers) {
    const samples: string[] = [];
    for (const row of rows) {
      const v = row[header];
      if (v && v.trim().length > 0) {
        samples.push(
          v.length > MAX_SAMPLE_CHARS ? v.slice(0, MAX_SAMPLE_CHARS) : v,
        );
        if (samples.length >= MAX_SAMPLES_PER_COLUMN) break;
      }
    }
    out[header] = samples;
  }
  return out;
}

// Reuse `getFeatureModel("extraction")` rather than the per-org
// `getAiSettingsSecret(orgId).model`. Mirrors `lib/expenses/ai-extraction.ts`
// — env is the global default, the per-org record only carries the
// encrypted API key. Kept consistent so future tooling that lists
// "AI features" sees one model knob across both extraction surfaces.
export async function getAiColumnMatches(
  input: AiMatchInput,
): Promise<AiSuggestion[]> {
  if (!isFeatureEnabled("extraction")) return [];
  if (input.unmappedHeaders.length === 0) return [];

  const fieldNames = new Set(input.fields.map((f) => f.name));
  const unmappedSet = new Set(input.unmappedHeaders);

  const promptObject = {
    entity: input.entityKey,
    instruction:
      "Match each unmappedHeader to the best ourField name. Confidence 0-1. " +
      "Use the sample values to disambiguate similar field names.",
    ourFields: input.fields,
    theirColumns: input.unmappedHeaders.map((header) => ({
      header,
      samples: input.samplesByHeader[header] ?? [],
    })),
  };

  try {
    const model = getFeatureModel("extraction");
    const provider = createAiProvider(input.apiKey, model);
    const { object } = await generateObject({
      model: provider,
      schema: matchSchema,
      prompt: JSON.stringify(promptObject),
    });

    return object.matches
      .filter(
        (m) =>
          fieldNames.has(m.ourField) &&
          unmappedSet.has(m.theirHeader) &&
          m.confidence >= SUGGESTION_THRESHOLD,
      )
      .map((m) => ({
        ourField: m.ourField,
        theirHeader: m.theirHeader,
        confidence: m.confidence,
        reason: m.reason,
        autoApply: m.confidence >= AUTO_APPLY_THRESHOLD,
      }));
  } catch (err) {
    log.error("ai column-match failed", {
      entity: input.entityKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
