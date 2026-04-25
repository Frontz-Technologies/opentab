import type {
  CreditNote,
  CreditNoteItem,
  Organisation,
} from "@opentab/db/schema";

interface CreditNotePdfTemplateProps {
  creditNote: CreditNote;
  items: CreditNoteItem[];
  org: Organisation;
  /** invoiceNumber of the credited invoice, if any */
  invoiceNumber?: string | null;
}

export function renderCreditNotePdfHtml({
  creditNote,
  items,
  org,
  invoiceNumber,
}: CreditNotePdfTemplateProps): string {
  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
        <strong>${escapeHtml(item.name)}</strong>
        ${item.description ? `<br/><span style="color: #6b7280; font-size: 12px;">${escapeHtml(item.description)}</span>` : ""}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity} ${item.unit ?? ""}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.unitPrice}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.taxRate}%</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${item.lineTotal}</td>
    </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; margin: 0; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .header-left h1 { margin: 0; color: #10b981; font-size: 28px; }
    .header-left p { margin: 4px 0; color: #6b7280; font-size: 13px; }
    .header-right { text-align: right; }
    .header-right h2 { margin: 0; font-size: 24px; color: #b3261e; }
    .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .details-section h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    .details-section p { margin: 2px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; padding: 10px 8px; background: #f3f4f6; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    th:nth-child(n+2) { text-align: right; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 250px; }
    .totals-table tr td { padding: 4px 0; font-size: 14px; }
    .totals-table tr td:last-child { text-align: right; font-family: monospace; }
    .totals-table .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #b3261e; padding-top: 8px; color: #b3261e; }
    .credits { margin-top: 12px; padding: 8px 12px; background: #fef2f2; border-left: 3px solid #b3261e; font-size: 12px; color: #6b7280; }
    .draft-watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 200px; font-weight: 800; color: rgba(16, 185, 129, 0.08); letter-spacing: 0.1em; pointer-events: none; user-select: none; z-index: 0; }
  </style>
</head>
<body>
  ${creditNote.creditNoteNumber === null ? `<div class="draft-watermark">DRAFT</div>` : ""}
  <div class="header">
    <div class="header-left">
      <h1>${escapeHtml(org.name)}</h1>
      ${org.taxId ? `<p>VAT: ${escapeHtml(org.taxId)}</p>` : ""}
      ${org.addressLine1 ? `<p>${escapeHtml(org.addressLine1)}</p>` : ""}
      ${org.city ? `<p>${escapeHtml(org.city)} ${escapeHtml(org.postalCode ?? "")}</p>` : ""}
    </div>
    <div class="header-right">
      <h2>CREDIT NOTE</h2>
      <p style="font-family: monospace; font-size: 16px;">${creditNote.creditNoteNumber === null ? `Draft #${creditNote.id.slice(0, 8)}` : escapeHtml(creditNote.creditNoteNumber)}</p>
    </div>
  </div>

  <div class="details">
    <div class="details-section">
      <h3>Bill To</h3>
      <p><strong>${escapeHtml(creditNote.contactName)}</strong></p>
      ${creditNote.contactEmail ? `<p>${escapeHtml(creditNote.contactEmail)}</p>` : ""}
      ${creditNote.contactVatNumber ? `<p>VAT: ${escapeHtml(creditNote.contactVatNumber)}</p>` : ""}
      ${creditNote.contactAddress ? `<p>${escapeHtml(creditNote.contactAddress)}</p>` : ""}
    </div>
    <div class="details-section" style="text-align: right;">
      <h3>Credit Note Details</h3>
      <p>Issue Date: ${creditNote.issueDate}</p>
      <p>Currency: ${escapeHtml(creditNote.currencyCode)}</p>
      <p>Reason: ${escapeHtml(creditNote.reason)}</p>
    </div>
  </div>

  ${
    invoiceNumber
      ? `<div class="credits">Credits invoice: <strong>${escapeHtml(invoiceNumber)}</strong></div>`
      : ""
  }

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Tax</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr><td>Subtotal</td><td>${creditNote.subtotal}</td></tr>
      <tr><td>Tax</td><td>${creditNote.taxAmount}</td></tr>
      <tr class="total-row"><td>Credit total</td><td>${creditNote.currencyCode} -${creditNote.total}</td></tr>
    </table>
  </div>

  ${
    creditNote.reasonNote || creditNote.notes
      ? `<div class="notes" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    ${creditNote.reasonNote ? `<h3 style="font-size: 11px; text-transform: uppercase; color: #6b7280; margin: 0 0 4px;">Reason note</h3><p style="font-size: 12px; color: #374151; white-space: pre-wrap;">${escapeHtml(creditNote.reasonNote)}</p>` : ""}
    ${creditNote.notes ? `<h3 style="font-size: 11px; text-transform: uppercase; color: #6b7280; margin: 12px 0 4px;">Notes</h3><p style="font-size: 12px; color: #374151; white-space: pre-wrap;">${escapeHtml(creditNote.notes)}</p>` : ""}
  </div>`
      : ""
  }
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
