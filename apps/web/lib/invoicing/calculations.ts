export interface LineItemInput {
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

export interface LineTotalResult {
  netAmount: string;
  taxAmount: string;
  lineTotal: string;
}

export interface InvoiceTotalsResult {
  subtotal: string;
  taxAmount: string;
  total: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toFixed2(n: number): string {
  return n.toFixed(2);
}

export function calculateLineTotal(input: {
  quantity: string;
  unitPrice: string;
  taxRate: string;
  usesInclusiveTax: boolean;
}): LineTotalResult {
  const qty = parseFloat(input.quantity);
  const price = parseFloat(input.unitPrice);
  const rate = parseFloat(input.taxRate);

  if (input.usesInclusiveTax) {
    const gross = round2(qty * price);
    const net = round2(gross / (1 + rate / 100));
    const tax = round2(gross - net);
    return {
      netAmount: toFixed2(net),
      taxAmount: toFixed2(tax),
      lineTotal: toFixed2(gross),
    };
  }

  const net = round2(qty * price);
  const tax = round2(net * (rate / 100));
  const total = round2(net + tax);
  return {
    netAmount: toFixed2(net),
    taxAmount: toFixed2(tax),
    lineTotal: toFixed2(total),
  };
}

export function calculateInvoiceTotals(
  items: LineItemInput[],
  usesInclusiveTax: boolean,
): InvoiceTotalsResult {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const line = calculateLineTotal({ ...item, usesInclusiveTax });
    subtotal += parseFloat(line.netAmount);
    taxAmount += parseFloat(line.taxAmount);
  }

  subtotal = round2(subtotal);
  taxAmount = round2(taxAmount);
  const total = round2(subtotal + taxAmount);

  return {
    subtotal: toFixed2(subtotal),
    taxAmount: toFixed2(taxAmount),
    total: toFixed2(total),
  };
}
