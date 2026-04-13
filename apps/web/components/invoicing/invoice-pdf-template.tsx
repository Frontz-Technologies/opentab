import type { Invoice, InvoiceItem, Organisation } from "@opentab/db/schema";

interface InvoicePdfTemplateProps {
  invoice: Invoice;
  items: InvoiceItem[];
  org: Organisation;
}

export function renderInvoicePdfHtml({
  invoice,
  items,
  org,
}: InvoicePdfTemplateProps): string {
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
    .header-right h2 { margin: 0; font-size: 24px; color: #1a1a2e; }
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
    .totals-table .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #1a1a2e; padding-top: 8px; }
    .notes { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .notes h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin: 0 0 4px; }
    .notes p { font-size: 12px; color: #374151; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${escapeHtml(org.name)}</h1>
      ${org.taxId ? `<p>VAT: ${escapeHtml(org.taxId)}</p>` : ""}
      ${org.addressLine1 ? `<p>${escapeHtml(org.addressLine1)}</p>` : ""}
      ${org.city ? `<p>${escapeHtml(org.city)} ${escapeHtml(org.postalCode ?? "")}</p>` : ""}
      ${org.phone ? `<p>${escapeHtml(org.phone)}</p>` : ""}
    </div>
    <div class="header-right">
      <h2>INVOICE</h2>
      <p style="font-family: monospace; font-size: 16px;">${escapeHtml(invoice.invoiceNumber)}</p>
    </div>
  </div>

  <div class="details">
    <div class="details-section">
      <h3>Bill To</h3>
      <p><strong>${escapeHtml(invoice.contactName)}</strong></p>
      ${invoice.contactEmail ? `<p>${escapeHtml(invoice.contactEmail)}</p>` : ""}
      ${invoice.contactVatNumber ? `<p>VAT: ${escapeHtml(invoice.contactVatNumber)}</p>` : ""}
      ${invoice.contactAddress ? `<p>${escapeHtml(invoice.contactAddress)}</p>` : ""}
    </div>
    <div class="details-section" style="text-align: right;">
      <h3>Invoice Details</h3>
      <p>Issue Date: ${invoice.issueDate}</p>
      ${invoice.dueDate ? `<p>Due Date: ${invoice.dueDate}</p>` : ""}
      <p>Currency: ${escapeHtml(invoice.currencyCode)}</p>
    </div>
  </div>

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
      <tr><td>Subtotal</td><td>${invoice.subtotal}</td></tr>
      <tr><td>Tax</td><td>${invoice.taxAmount}</td></tr>
      <tr class="total-row"><td>Total</td><td>${invoice.currencyCode} ${invoice.total}</td></tr>
    </table>
  </div>

  ${
    invoice.notes || invoice.terms
      ? `<div class="notes">
    ${invoice.notes ? `<h3>Notes</h3><p>${escapeHtml(invoice.notes)}</p>` : ""}
    ${invoice.terms ? `<h3>Terms &amp; Conditions</h3><p>${escapeHtml(invoice.terms)}</p>` : ""}
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
