import { generateObject } from "ai";
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

const extractionSchema = z.object({
  vendorName: z
    .string()
    .nullable()
    .describe("The supplier/vendor name from the receipt"),
  vendorVat: z
    .string()
    .nullable()
    .describe("The VAT/tax ID number of the vendor"),
  date: z
    .string()
    .nullable()
    .describe("The receipt/invoice date in YYYY-MM-DD format"),
  totalAmount: z
    .string()
    .nullable()
    .describe("The total amount as a decimal string (e.g. '123.45')"),
  currency: z
    .string()
    .nullable()
    .describe("3-letter ISO currency code (e.g. 'EUR', 'USD')"),
  description: z
    .string()
    .nullable()
    .describe("Brief description of what was purchased"),
  category: z.string().nullable().describe("Expense category"),
  lineItems: z
    .array(
      z.object({
        name: z.string().describe("Item description"),
        quantity: z.string().describe("Quantity as decimal string (e.g. '1')"),
        unitPrice: z
          .string()
          .describe("Unit price as decimal string (e.g. '10.00')"),
        taxRate: z
          .string()
          .describe("Tax rate as percentage string (e.g. '24')"),
      }),
    )
    .describe("Individual line items from the receipt"),
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

const EXTRACTION_PROMPT =
  "Extract structured data from this receipt/invoice. Use null for any field you cannot confidently read.";

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

    const aiTimer = log.time("ai-api-call");
    const result = await generateObject({
      model: provider,
      schema: extractionSchema,
      messages: [{ role: "user", content }],
      maxTokens: 2000,
    });
    const data = result.object as z.infer<typeof extractionSchema>;
    aiTimer("ai response received", {
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
