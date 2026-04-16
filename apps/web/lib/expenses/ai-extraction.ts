import { generateObject, NoObjectGeneratedError, generateText } from "ai";
import { z } from "zod";
import { createAiProvider } from "@/lib/ai/provider";
import {
  getModelCapabilities,
  type ModelCapabilities,
} from "@/lib/actions/ai-settings";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("ai-extraction");

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
  category: string | null;
  lineItems: ExtractedLineItem[];
}

/** Coerce any value to string or null */
const coerceString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v != null ? String(v) : null));

const coerceStringRequired = z
  .union([z.string(), z.number()])
  .transform((v) => String(v));

const extractionSchema = z.object({
  vendorName: coerceString.optional().default(null),
  vendorVat: coerceString.optional().default(null),
  date: coerceString.optional().default(null),
  totalAmount: coerceString.optional().default(null),
  currency: coerceString.optional().default(null),
  description: coerceString.optional().default(null),
  category: coerceString.optional().default(null),
  lineItems: z
    .array(
      z.object({
        name: coerceStringRequired.optional().default(""),
        quantity: coerceStringRequired.optional().default("1"),
        unitPrice: coerceStringRequired.optional().default("0"),
        taxRate: coerceStringRequired.optional().default("0"),
      }),
    )
    .optional()
    .default([]),
});

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
 */
function buildContentBlocks(
  buffer: Buffer,
  mimeType: string,
  strategy: "file" | "image",
): Array<
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "file"; data: string; mimeType: string }
> {
  const base64 = buffer.toString("base64");

  if (strategy === "file") {
    return [
      { type: "text", text: EXTRACTION_PROMPT },
      { type: "file", data: base64, mimeType },
    ];
  }

  const dataUrl = `data:${mimeType};base64,${base64}`;
  return [
    { type: "text", text: EXTRACTION_PROMPT },
    { type: "image", image: dataUrl },
  ];
}

const EXTRACTION_PROMPT = `Extract structured data from this receipt/invoice as JSON.
Use null for any field you cannot confidently read.

Required JSON format:
{
  "vendorName": "string or null",
  "vendorVat": "string or null",
  "date": "YYYY-MM-DD or null",
  "totalAmount": "number or string or null",
  "currency": "3-letter ISO code or null",
  "description": "string or null",
  "category": "string or null",
  "lineItems": [{"name": "string", "quantity": "number", "unitPrice": "number", "taxRate": "number"}]
}

Return ONLY valid JSON.`;

export async function extractReceiptData(
  buffer: Buffer,
  mimeType: string,
  apiKey: string,
  model: string,
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

    const content = buildContentBlocks(buffer, mimeType, strategy);
    const provider = createAiProvider(apiKey, model);

    // Try structured output first (mode: json injects schema into prompt)
    const aiTimer = log.time("ai-api-call");
    try {
      const result = await generateObject({
        model: provider,
        mode: "json",
        schema: extractionSchema,
        messages: [{ role: "user", content }],
        maxOutputTokens: 2000,
      });
      const data = result.object as z.infer<typeof extractionSchema>;
      aiTimer("structured extraction succeeded", {
        model,
        mode: "generateObject",
      });
      log.info("extraction result", {
        model,
        hasVendor: !!data.vendorName,
        hasTotal: !!data.totalAmount,
        lineItemCount: data.lineItems.length,
      });
      return data;
    } catch (structuredErr) {
      // Fall back to generateText + manual parse if structured output fails
      if (!NoObjectGeneratedError.isInstance(structuredErr))
        throw structuredErr;
      log.warn("structured output failed, falling back to text parse", {
        model,
        error: structuredErr.message,
      });
    }

    // Fallback: generateText + manual JSON parse + Zod coercion
    const { text } = await generateText({
      model: provider,
      messages: [{ role: "user", content }],
      maxOutputTokens: 2000,
    });
    aiTimer("text fallback extraction", { model, responseLength: text.length });

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const raw = JSON.parse(cleaned);
    const data = extractionSchema.parse(raw);

    log.info("extraction result (fallback)", {
      model,
      hasVendor: !!data.vendorName,
      hasTotal: !!data.totalAmount,
      lineItemCount: data.lineItems.length,
    });

    return data;
  } catch (err) {
    log.error("extraction failed", {
      model,
      mimeType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
