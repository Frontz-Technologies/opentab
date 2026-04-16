import { generateText } from "ai";
import { createAiProvider } from "@/lib/ai/provider";
import {
  getModelCapabilities,
  type ModelCapabilities,
} from "@/lib/actions/ai-settings";

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
  confidence: Record<string, number>;
}

/**
 * Normalize AI response into a consistent structure.
 * Handles two formats:
 *   Format A (nested): { vendorName: { value: "...", confidence: 0.9 } }
 *   Format B (flat):   { vendorName: "...", vendorName_confidence: 0.9 }
 */
export function parseExtractionResponse(
  raw: Record<string, unknown>,
): ExtractedExpenseData {
  const fields = [
    "vendorName",
    "vendorVat",
    "date",
    "totalAmount",
    "currency",
    "description",
    "category",
  ];
  const result: Record<string, string | null> = {};
  const confidence: Record<string, number> = {};

  for (const field of fields) {
    const val = raw[field];
    if (val && typeof val === "object" && "value" in val) {
      // Format A: nested { value, confidence }
      result[field] = String((val as { value: unknown }).value ?? "") || null;
      confidence[field] = Number(
        (val as { confidence?: unknown }).confidence ?? 0,
      );
    } else {
      // Format B: flat value + separate confidence key
      result[field] = val != null ? String(val) : null;
      confidence[field] = Number(raw[`${field}_confidence`] ?? 0);
    }
  }

  const rawLineItems = raw.lineItems;
  const lineItems: ExtractedLineItem[] = [];
  if (Array.isArray(rawLineItems)) {
    for (const item of rawLineItems) {
      if (item && typeof item === "object") {
        const li = item as Record<string, unknown>;
        lineItems.push({
          name: String(li.name ?? ""),
          quantity: String(li.quantity ?? "1"),
          unitPrice: String(li.unitPrice ?? "0"),
          taxRate: String(li.taxRate ?? "0"),
        });
      }
    }
  }

  return {
    vendorName: result.vendorName ?? null,
    vendorVat: result.vendorVat ?? null,
    date: result.date ?? null,
    totalAmount: result.totalAmount ?? null,
    currency: result.currency ?? null,
    description: result.description ?? null,
    category: result.category ?? null,
    lineItems,
    confidence,
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
    // PDF: prefer native file support, fall back to image if model supports it
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

  // image strategy — for images, send directly; for PDFs this path shouldn't
  // be reached without prior conversion, but we handle it gracefully
  const dataUrl = `data:${mimeType};base64,${base64}`;
  return [
    { type: "text", text: EXTRACTION_PROMPT },
    { type: "image", image: dataUrl },
  ];
}

const EXTRACTION_PROMPT = `You are a receipt/invoice data extractor. Analyze the provided document and extract structured data.

Return a JSON object with these fields. Use null for any field you cannot confidently read:

{
  "vendorName": "string or null - the supplier/vendor name",
  "vendorVat": "string or null - the VAT/tax ID number of the vendor",
  "date": "YYYY-MM-DD or null - the receipt/invoice date",
  "totalAmount": "string decimal or null - the total amount (e.g. '123.45')",
  "currency": "string 3-letter ISO code or null (e.g. 'EUR', 'USD')",
  "description": "string or null - brief description of what was purchased",
  "category": "string or null - expense category",
  "lineItems": [
    {
      "name": "item description",
      "quantity": "decimal string (e.g. '1')",
      "unitPrice": "decimal string (e.g. '10.00')",
      "taxRate": "decimal percentage string (e.g. '24')"
    }
  ],
  "confidence": {
    "vendorName": 0.0,
    "vendorVat": 0.0,
    "date": 0.0,
    "totalAmount": 0.0,
    "currency": 0.0,
    "description": 0.0,
    "category": 0.0
  }
}

Return ONLY valid JSON. No markdown, no explanation.`;

export async function extractReceiptData(
  buffer: Buffer,
  mimeType: string,
  apiKey: string,
  model: string,
): Promise<ExtractedExpenseData | null> {
  try {
    const capabilities = await getModelCapabilities(model);
    const strategy = getExtractionStrategy(mimeType, capabilities);

    if (!strategy) return null;

    const content = buildContentBlocks(buffer, mimeType, strategy);
    const provider = createAiProvider(apiKey, model);

    const { text } = await generateText({
      model: provider,
      messages: [{ role: "user", content }],
      maxTokens: 2000,
    });

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return parseExtractionResponse(parsed);
  } catch {
    return null;
  }
}
