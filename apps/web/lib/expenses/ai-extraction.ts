import { pdfToImage } from "./pdf-convert";

export interface ExtractedExpenseData {
  vendorName: string | null;
  vendorVat: string | null;
  date: string | null;
  totalAmount: string | null;
  currency: string | null;
  description: string | null;
  category: string | null;
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

  return {
    vendorName: result.vendorName ?? null,
    vendorVat: result.vendorVat ?? null,
    date: result.date ?? null,
    totalAmount: result.totalAmount ?? null,
    currency: result.currency ?? null,
    description: result.description ?? null,
    category: result.category ?? null,
    confidence,
  };
}

/**
 * Prepare a file buffer for vision API submission.
 * If the file is a PDF, converts the first page to PNG.
 */
export async function prepareImageForExtraction(
  originalBuffer: Buffer,
  originalMimeType: string,
): Promise<{ buffer: Buffer; mimeType: string; dataUrl: string }> {
  let imageBuffer = originalBuffer;
  let mimeType = originalMimeType;

  if (mimeType === "application/pdf") {
    imageBuffer = await pdfToImage(originalBuffer);
    mimeType = "image/png";
  }

  const base64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return { buffer: imageBuffer, mimeType, dataUrl };
}
