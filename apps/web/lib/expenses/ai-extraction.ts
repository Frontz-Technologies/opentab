import { generateObject, NoObjectGeneratedError, generateText } from "ai";
import { z } from "zod";
import { createAiProvider } from "@/lib/ai/provider";
import {
  getModelCapabilities,
  type ModelCapabilities,
} from "@/lib/actions/ai-settings";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("ai-extraction");

const loggedSchemaKeys = new Set<string>();

// Dump the JSON-Schema form of the extraction schema once per
// category-code set per process. #175 diagnostic step 2: we need to
// inspect what the provider's structured-output layer actually sees —
// the Zod → JSON-Schema conversion can silently produce shapes (oneOf,
// nullable expansions, enum constraints) that a given model rejects.
function logSchemaOnce(categoryCodes: readonly string[]): void {
  const key = [...categoryCodes].sort().join(",");
  if (loggedSchemaKeys.has(key)) return;
  loggedSchemaKeys.add(key);
  try {
    const schema = buildExtractionSchema(categoryCodes);
    const jsonSchema = (
      z as unknown as { toJSONSchema: (s: unknown) => unknown }
    ).toJSONSchema(schema);
    log.info("extraction JSON schema", {
      categoryCount: categoryCodes.length,
      jsonSchema,
    });
  } catch (err) {
    log.warn("schema dump skipped", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface ExtractedLineItem {
  name: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

export interface ExtractedExpenseData {
  vendorName: string | null;
  vendorVat: string | null;
  date: string | null;
  totalAmount: string | null;
  currency: string | null;
  description: string | null;
  categoryCode: string | null;
  lineItems: ExtractedLineItem[];
}

export interface CategoryHint {
  code: string;
  name: string;
}

/**
 * Build the extraction schema.
 *
 * IMPORTANT: Zod v4's `z.toJSONSchema()` (which AI SDK v6 invokes under
 * the hood when `generateObject({ schema })` is called) cannot represent
 * `.transform()` — it throws "Transforms cannot be represented in JSON
 * Schema". Keep this schema pure data-shape: scalar types, unions,
 * arrays, enums, nullable. All coercion (e.g. number → string) happens
 * post-parse in `normalizeExtractedData`.
 */
const scalar = z.union([z.string(), z.number(), z.null()]);

export function buildExtractionSchema(categoryCodes: readonly string[]) {
  const categoryField =
    categoryCodes.length > 0
      ? z
          .enum(categoryCodes as unknown as [string, ...string[]])
          .nullable()
          .optional()
      : z.null().optional();

  return z.object({
    vendorName: scalar.optional(),
    vendorVat: scalar.optional(),
    date: scalar.optional(),
    totalAmount: scalar.optional(),
    currency: scalar.optional(),
    description: scalar.optional(),
    categoryCode: categoryField,
    lineItems: z
      .array(
        z.object({
          name: scalar.optional(),
          quantity: scalar.optional(),
          unitPrice: scalar.optional(),
          taxRate: scalar.optional(),
        }),
      )
      .optional(),
  });
}

function coerceStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function coerceString(v: unknown, fallback: string): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

/** Post-parse normalization — the Zod schema deliberately keeps raw
 * shape (union of string|number|null); this function turns it into the
 * tidy string-or-null form consumers expect. */
export function normalizeExtractedData(raw: {
  vendorName?: string | number | null;
  vendorVat?: string | number | null;
  date?: string | number | null;
  totalAmount?: string | number | null;
  currency?: string | number | null;
  description?: string | number | null;
  categoryCode?: string | null;
  lineItems?: {
    name?: string | number | null;
    quantity?: string | number | null;
    unitPrice?: string | number | null;
    taxRate?: string | number | null;
  }[];
}): ExtractedExpenseData {
  return {
    vendorName: coerceStringOrNull(raw.vendorName),
    vendorVat: coerceStringOrNull(raw.vendorVat),
    date: coerceStringOrNull(raw.date),
    totalAmount: coerceStringOrNull(raw.totalAmount),
    currency: coerceStringOrNull(raw.currency),
    description: coerceStringOrNull(raw.description),
    categoryCode: raw.categoryCode ?? null,
    lineItems: (raw.lineItems ?? []).map((li) => ({
      name: coerceString(li.name, ""),
      quantity: coerceString(li.quantity, "1"),
      unitPrice: coerceString(li.unitPrice, "0"),
      taxRate: coerceString(li.taxRate, "0"),
    })),
  };
}

/**
 * Check if the model can process the given file type.
 * Returns the best content strategy or null if unsupported.
 */
export function getExtractionStrategy(
  mimeType: string,
  capabilities: ModelCapabilities,
): "file" | "image" | null {
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  if (isPdf) {
    if (capabilities.file) return "file";
    if (capabilities.image) return "image";
    return null;
  }

  if (isImage) {
    if (capabilities.image) return "image";
    return null;
  }

  return null;
}

/**
 * Prepare content blocks for the AI message based on the extraction strategy.
 * AI SDK v6 (ai@^6): file/image parts use `mediaType`, not `mimeType`.
 */
function buildContentBlocks(
  buffer: Buffer,
  mimeType: string,
  strategy: "file" | "image",
  prompt: string,
) {
  const base64 = buffer.toString("base64");

  if (strategy === "file") {
    return [
      { type: "text", text: prompt },
      { type: "file", data: base64, mediaType: mimeType },
    ];
  }

  return [
    { type: "text", text: prompt },
    { type: "image", image: base64, mediaType: mimeType },
  ];
}

function buildExtractionPrompt(categories: readonly CategoryHint[]): string {
  const categoryBlock =
    categories.length > 0
      ? `\n\nPick the best-matching categoryCode from this list (use its code, not its display name); use null if no category clearly fits:\n${categories
          .map((c) => `- ${c.code}: ${c.name}`)
          .join("\n")}`
      : "\n\nSet categoryCode to null (no categories available).";

  return `Extract structured data from this receipt/invoice as JSON.
Use null for any field you cannot confidently read.

Required JSON format:
{
  "vendorName": "string or null",
  "vendorVat": "string or null",
  "date": "YYYY-MM-DD or null",
  "totalAmount": "number or string or null",
  "currency": "3-letter ISO code or null",
  "description": "string or null",
  "categoryCode": "string code from the list below, or null",
  "lineItems": [{"name": "string", "quantity": "number", "unitPrice": "number", "taxRate": "number"}]
}${categoryBlock}

Return ONLY valid JSON.`;
}

export async function extractReceiptData(
  buffer: Buffer,
  mimeType: string,
  apiKey: string,
  model: string,
  categories: readonly CategoryHint[] = [],
): Promise<ExtractedExpenseData | null> {
  try {
    const capTimer = log.time("capability-check");
    const capabilities = await getModelCapabilities(model);
    capTimer("capabilities resolved", {
      model,
      text: capabilities.text,
      image: capabilities.image,
      file: capabilities.file,
    });

    const strategy = getExtractionStrategy(mimeType, capabilities);
    log.info("extraction strategy selected", { model, mimeType, strategy });

    if (!strategy) {
      log.warn("model does not support this file type", {
        model,
        mimeType,
        capabilities,
      });
      return null;
    }

    const categoryCodes = categories.map((c) => c.code);
    const extractionSchema = buildExtractionSchema(categoryCodes);
    logSchemaOnce(categoryCodes);
    const prompt = buildExtractionPrompt(categories);
    const content = buildContentBlocks(buffer, mimeType, strategy, prompt);
    const provider = createAiProvider(apiKey, model);
    const messages = [{ role: "user" as const, content: content as any }];

    const aiTimer = log.time("ai-api-call");
    try {
      const result = await generateObject({
        model: provider,
        schema: extractionSchema,
        messages,
        maxOutputTokens: 2000,
      });
      const normalized = normalizeExtractedData(result.object);
      aiTimer("structured extraction succeeded", {
        model,
        mode: "generateObject",
      });
      log.info("extraction result", {
        model,
        hasVendor: !!normalized.vendorName,
        hasTotal: !!normalized.totalAmount,
        hasCategory: !!normalized.categoryCode,
        lineItemCount: normalized.lineItems.length,
      });
      return normalized;
    } catch (structuredErr) {
      if (!NoObjectGeneratedError.isInstance(structuredErr))
        throw structuredErr;
      // Surface the raw model output so #175 diagnostic step 1 can
      // distinguish markdown-wrapped JSON, garbage, and schema-shape
      // mismatch. Clipped to 1 KB — receipts are well under this; we
      // only need a shape hint, not the full payload.
      const rawText =
        typeof (structuredErr as { text?: unknown }).text === "string"
          ? (structuredErr as { text: string }).text
          : undefined;
      const RAW_LIMIT = 1024;
      const clipped = rawText ? rawText.slice(0, RAW_LIMIT) : undefined;
      log.warn("structured output failed, falling back to text parse", {
        model,
        error: structuredErr.message,
        rawResponse: clipped,
        rawResponseClipped: rawText ? rawText.length > RAW_LIMIT : false,
      });
    }

    // Fallback: generateText + manual JSON parse + Zod coercion
    const { text } = await generateText({
      model: provider,
      messages,
      maxOutputTokens: 2000,
    });
    aiTimer("text fallback extraction", { model, responseLength: text.length });

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const raw = JSON.parse(cleaned);
    const parsed = extractionSchema.parse(raw);
    const normalized = normalizeExtractedData(parsed);

    log.info("extraction result (fallback)", {
      model,
      hasVendor: !!normalized.vendorName,
      hasTotal: !!normalized.totalAmount,
      hasCategory: !!normalized.categoryCode,
      lineItemCount: normalized.lineItems.length,
    });

    return normalized;
  } catch (err) {
    log.error("extraction failed", {
      model,
      mimeType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
