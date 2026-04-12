import type { Invoice } from "@opentab/db/schema";

interface EmailContent {
  subject: string;
  body: string;
}

/**
 * Generate an email for sending an invoice.
 * If OPENROUTER_API_KEY is set, uses AI generation.
 * Otherwise, falls back to a static template.
 */
export async function generateInvoiceEmail(
  invoice: Invoice,
  orgName: string,
): Promise<EmailContent> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (apiKey) {
    return generateAiEmail(invoice, orgName, apiKey);
  }

  return generateFallbackEmail(invoice, orgName);
}

async function generateAiEmail(
  invoice: Invoice,
  orgName: string,
  apiKey: string,
): Promise<EmailContent> {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4",
          messages: [
            {
              role: "system",
              content:
                "You are a professional business email writer. Generate a short, polite email for sending an invoice. Return JSON with { subject, body } fields only. The body should be plain text, 3-5 sentences. Do not include any markdown.",
            },
            {
              role: "user",
              content: `Write an invoice email with these details:
- From: ${orgName}
- To: ${invoice.contactName}
- Invoice number: ${invoice.invoiceNumber}
- Amount: ${invoice.currencyCode} ${invoice.total}
- Due date: ${invoice.dueDate ?? "upon receipt"}
- Issue date: ${invoice.issueDate}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      },
    );

    if (!response.ok) {
      return generateFallbackEmail(invoice, orgName);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return generateFallbackEmail(invoice, orgName);
    }

    const parsed = JSON.parse(content);
    return {
      subject:
        parsed.subject ?? `Invoice ${invoice.invoiceNumber} from ${orgName}`,
      body: parsed.body ?? "",
    };
  } catch {
    return generateFallbackEmail(invoice, orgName);
  }
}

function generateFallbackEmail(
  invoice: Invoice,
  orgName: string,
): EmailContent {
  const dueText = invoice.dueDate
    ? `Payment is due by ${invoice.dueDate}.`
    : "Payment is due upon receipt.";

  return {
    subject: `Invoice ${invoice.invoiceNumber} from ${orgName}`,
    body: `Dear ${invoice.contactName},

Please find attached invoice ${invoice.invoiceNumber} for ${invoice.currencyCode} ${invoice.total}.

${dueText}

If you have any questions, please don't hesitate to reach out.

Best regards,
${orgName}`,
  };
}

/**
 * Send an invoice email. Currently a placeholder — integrate with your
 * SMTP provider (Resend, Nodemailer, etc.) in production.
 */
export async function sendInvoiceEmail(
  to: string,
  content: EmailContent,
  _pdfBuffer?: Buffer,
): Promise<boolean> {
  // TODO: Integrate with email provider (Resend or SMTP)
  console.log(`[Email] Would send to ${to}: ${content.subject}`);
  return true;
}
