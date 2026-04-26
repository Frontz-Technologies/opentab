import type { Invoice } from "@opentab/db/schema";
import { sendEmail } from "../email/transport";

interface EmailContent {
  subject: string;
  body: string;
}

/**
 * Generate the invoice email body. Beta uses a static template only.
 * The full editable-template feature lives in issue #223.
 */
export async function generateInvoiceEmail(
  invoice: Invoice,
  orgName: string,
): Promise<EmailContent> {
  return generateFallbackEmail(invoice, orgName);
}

function generateFallbackEmail(
  invoice: Invoice,
  orgName: string,
): EmailContent {
  const total = `${invoice.total} ${invoice.currencyCode ?? "EUR"}`;
  const dueText = invoice.dueDate
    ? `Payment is due by ${invoice.dueDate}.`
    : "";
  return {
    subject: `Invoice ${invoice.invoiceNumber ?? ""} from ${orgName}`,
    body: `Hello,

Please find attached invoice ${invoice.invoiceNumber ?? ""} for ${total}.

${dueText}

If you have any questions, please don't hesitate to reach out.

Best regards,
${orgName}`,
  };
}

export async function sendInvoiceEmail(
  to: string,
  content: EmailContent,
  pdfBuffer?: Buffer,
): Promise<void> {
  const filename = content.subject.replace(/[^a-z0-9-]/gi, "_") + ".pdf";
  await sendEmail({
    to,
    subject: content.subject,
    text: content.body,
    ...(pdfBuffer
      ? {
          attachments: [
            {
              filename,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        }
      : {}),
  });
}
