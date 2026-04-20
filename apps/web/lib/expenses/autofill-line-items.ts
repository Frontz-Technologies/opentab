import type { LineItem } from "@/components/invoicing/line-items-builder";
import { calculateLineTotal } from "@/lib/invoicing/calculations";

export interface ExtractedLineItemInput {
  name: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

export interface BuildAutofilledLineItemsInput {
  lineItems: readonly ExtractedLineItemInput[];
  totalAmount?: string | null;
  description?: string | null;
  defaultTaxRate: string;
  usesInclusiveTax: boolean;
}

// `LineItemsBuilder.recalcItem` runs only on manual edits, so line
// items seeded programmatically (from AI autofill) render with
// whatever taxAmount/lineTotal strings we pass. Hard-coding "0" —
// which is what the form used to do — leaves the VAT amount, the line
// total, and therefore the footer ΦΠΑ/Σύνολο all stuck at 0. This
// helper applies the same calculation the builder uses for manual
// edits, so autofilled items arrive in a consistent state.
export function buildAutofilledLineItems(
  input: BuildAutofilledLineItemsInput,
): LineItem[] {
  const {
    lineItems,
    totalAmount,
    description,
    defaultTaxRate,
    usesInclusiveTax,
  } = input;

  const toItem = (li: ExtractedLineItemInput, sortOrder: number): LineItem => {
    // Empty string and the literal "0" both mean "AI didn't have a
    // confident rate" — treat them the same as missing and fall back
    // to the org default.
    const rawRate = (li.taxRate ?? "").trim();
    const taxRate =
      rawRate === "" || parseFloat(rawRate) === 0 ? defaultTaxRate : rawRate;
    const { taxAmount, lineTotal } = calculateLineTotal({
      quantity: li.quantity || "0",
      unitPrice: li.unitPrice || "0",
      taxRate: taxRate || "0",
      usesInclusiveTax,
    });
    return {
      id: crypto.randomUUID(),
      productId: "",
      sortOrder,
      name: li.name,
      description: "",
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      unit: "",
      taxCategory: "",
      taxRate,
      taxAmount,
      lineTotal,
    };
  };

  if (lineItems.length > 0) {
    return lineItems.map((li, i) => toItem(li, i));
  }

  if (totalAmount) {
    return [
      toItem(
        {
          name: description || "Receipt item",
          quantity: "1",
          unitPrice: totalAmount,
          taxRate: "",
        },
        0,
      ),
    ];
  }

  return [];
}
