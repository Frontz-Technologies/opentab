export interface ExtractedExpenseData {
  supplier?: {
    name: string;
    vatNumber?: string;
    address?: string;
    confidence: number;
  };
  invoiceNumber?: {
    value: string;
    confidence: number;
  };
  issueDate?: {
    value: string; // ISO date
    confidence: number;
  };
  lineItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
    confidence: number;
  }>;
  subtotal?: { value: number; confidence: number };
  taxAmount?: { value: number; confidence: number };
  total?: { value: number; confidence: number };
  currency?: { value: string; confidence: number };
}

export const AI_CONFIDENCE = {
  AUTO_FILL: 0.85,
  SUGGEST: 0.5,
  DISCARD: 0.5,
} as const;

export interface ExtractionPromptContext {
  orgCountryCode: string;
  orgCurrency: string;
  knownSuppliers: Array<{ name: string; vatNumber: string }>;
  knownCategories: Array<{ code: string; name: string }>;
}

function buildExtractionSystemPrompt(context: ExtractionPromptContext): string {
  return `You are a financial document extraction AI. Extract all financial data from the provided receipt or invoice image.

Return a JSON object with the following structure:
{
  "supplier": { "name": string, "vatNumber": string | null, "address": string | null, "confidence": number },
  "invoiceNumber": { "value": string, "confidence": number } | null,
  "issueDate": { "value": "YYYY-MM-DD", "confidence": number } | null,
  "lineItems": [{ "name": string, "quantity": number, "unitPrice": number, "taxRate": number, "total": number, "confidence": number }],
  "subtotal": { "value": number, "confidence": number } | null,
  "taxAmount": { "value": number, "confidence": number } | null,
  "total": { "value": number, "confidence": number } | null,
  "currency": { "value": string, "confidence": number } | null
}

Confidence scores range from 0.0 to 1.0. Use 0.0 if the field is not found or illegible.

Context:
- Country: ${context.orgCountryCode}
- Default currency: ${context.orgCurrency}
- Known suppliers for matching: ${JSON.stringify(context.knownSuppliers.slice(0, 20))}

Parse numbers according to ${context.orgCountryCode === "GR" ? "European" : "local"} conventions (comma as decimal separator if applicable).
Always return valid JSON. If a field is completely absent, set it to null.`;
}

export async function extractReceiptData(
  fileBuffer: Buffer,
  mimeType: string,
  context: ExtractionPromptContext,
): Promise<ExtractedExpenseData> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY not configured. AI extraction is unavailable.",
    );
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-20250514",
        messages: [
          {
            role: "system",
            content: buildExtractionSystemPrompt(context),
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
                },
              },
              {
                type: "text",
                text: "Extract all financial data from this receipt/invoice. Return structured JSON with confidence scores for each field.",
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `OpenRouter API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from OpenRouter API");
  }

  return parseExtractionResponse(content);
}

export function parseExtractionResponse(raw: string): ExtractedExpenseData {
  const parsed = JSON.parse(raw);

  return {
    supplier: parsed.supplier ?? undefined,
    invoiceNumber: parsed.invoiceNumber ?? undefined,
    issueDate: parsed.issueDate ?? undefined,
    lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
    subtotal: parsed.subtotal ?? undefined,
    taxAmount: parsed.taxAmount ?? undefined,
    total: parsed.total ?? undefined,
    currency: parsed.currency ?? undefined,
  };
}

export function shouldAutoFill(confidence: number): boolean {
  return confidence >= AI_CONFIDENCE.AUTO_FILL;
}

export function shouldSuggest(confidence: number): boolean {
  return (
    confidence >= AI_CONFIDENCE.SUGGEST && confidence < AI_CONFIDENCE.AUTO_FILL
  );
}

export function shouldDiscard(confidence: number): boolean {
  return confidence < AI_CONFIDENCE.DISCARD;
}
