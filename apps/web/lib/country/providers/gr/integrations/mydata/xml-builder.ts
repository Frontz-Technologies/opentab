import type { MyDataInvoice } from "./types";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildCounterpart(invoice: MyDataInvoice): string {
  if (!invoice.counterpart) return "";
  return `
    <counterpart>
      <vatNumber>${escapeXml(invoice.counterpart.vatNumber)}</vatNumber>
      <country>${escapeXml(invoice.counterpart.country)}</country>
      <branch>${invoice.counterpart.branch}</branch>
    </counterpart>`;
}

function buildPaymentMethods(invoice: MyDataInvoice): string {
  const methods = invoice.paymentMethods
    .map(
      (pm) => `
      <paymentMethodDetail>
        <type>${pm.type}</type>
        <amount>${escapeXml(pm.amount)}</amount>
      </paymentMethodDetail>`,
    )
    .join("");

  return `
    <paymentMethods>${methods}
    </paymentMethods>`;
}

function buildIncomeClassification(
  ic:
    | {
        classificationType: string;
        classificationCategory: string;
        amount: string;
      }
    | undefined,
): string {
  if (!ic) return "";
  return `
      <incomeClassification>
        <icls:classificationType>${escapeXml(ic.classificationType)}</icls:classificationType>
        <icls:classificationCategory>${escapeXml(ic.classificationCategory)}</icls:classificationCategory>
        <icls:amount>${escapeXml(ic.amount)}</icls:amount>
      </incomeClassification>`;
}

function buildInvoiceDetails(invoice: MyDataInvoice): string {
  return invoice.invoiceDetails
    .map(
      (detail) => `
    <invoiceDetails>
      <lineNumber>${detail.lineNumber}</lineNumber>
      <netValue>${escapeXml(detail.netValue)}</netValue>
      <vatCategory>${detail.vatCategory}</vatCategory>
      <vatAmount>${escapeXml(detail.vatAmount)}</vatAmount>${buildIncomeClassification(detail.incomeClassification)}
    </invoiceDetails>`,
    )
    .join("");
}

function buildInvoiceSummary(invoice: MyDataInvoice): string {
  const s = invoice.invoiceSummary;
  return `
    <invoiceSummary>
      <totalNetValue>${escapeXml(s.totalNetValue)}</totalNetValue>
      <totalVatAmount>${escapeXml(s.totalVatAmount)}</totalVatAmount>
      <totalWithheldAmount>${escapeXml(s.totalWithheldAmount)}</totalWithheldAmount>
      <totalFeesAmount>${escapeXml(s.totalFeesAmount)}</totalFeesAmount>
      <totalStampDutyAmount>${escapeXml(s.totalStampDutyAmount)}</totalStampDutyAmount>
      <totalOtherTaxesAmount>${escapeXml(s.totalOtherTaxesAmount)}</totalOtherTaxesAmount>
      <totalDeductionsAmount>${escapeXml(s.totalDeductionsAmount)}</totalDeductionsAmount>
      <totalGrossValue>${escapeXml(s.totalGrossValue)}</totalGrossValue>${buildIncomeClassification(s.incomeClassification)}
    </invoiceSummary>`;
}

function buildCorrelatedInvoices(invoice: MyDataInvoice): string {
  if (!invoice.correlatedInvoices?.length) return "";
  return invoice.correlatedInvoices
    .map((mark) => `\n      <correlatedInvoices>${escapeXml(mark)}</correlatedInvoices>`)
    .join("");
}

function buildInvoice(invoice: MyDataInvoice): string {
  return `
  <invoice>
    <issuer>
      <vatNumber>${escapeXml(invoice.issuer.vatNumber)}</vatNumber>
      <country>${escapeXml(invoice.issuer.country)}</country>
      <branch>${invoice.issuer.branch}</branch>
    </issuer>${buildCounterpart(invoice)}
    <invoiceHeader>
      <series>${escapeXml(invoice.invoiceHeader.series)}</series>
      <aa>${escapeXml(invoice.invoiceHeader.aa)}</aa>
      <issueDate>${escapeXml(invoice.invoiceHeader.issueDate)}</issueDate>
      <invoiceType>${escapeXml(invoice.invoiceHeader.invoiceType)}</invoiceType>
      <currency>${escapeXml(invoice.invoiceHeader.currency)}</currency>${buildCorrelatedInvoices(invoice)}
    </invoiceHeader>${buildPaymentMethods(invoice)}${buildInvoiceDetails(invoice)}${buildInvoiceSummary(invoice)}
  </invoice>`;
}

export function buildInvoicesDoc(invoices: MyDataInvoice[]): string {
  const invoiceXml = invoices.map(buildInvoice).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<InvoicesDoc xmlns="http://www.aade.gr/myDATA/invoice/v1.0"
             xmlns:icls="http://www.aade.gr/myDATA/incomeClassificaton/v1.0">${invoiceXml}
</InvoicesDoc>`;
}
