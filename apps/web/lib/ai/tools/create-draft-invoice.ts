import { revalidatePath } from "next/cache";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { createDraftInvoice } from "@/lib/invoicing/draft-invoices";
import type { ConfirmToolCall, PendingConfirmation } from "@/lib/ai/types";

const createDraftInvoiceParameters = z.object({
  contactId: z.string().uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  currencyCode: z.string().length(3).optional(),
  usesInclusiveTax: z.boolean().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  internalNotes: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      quantity: z.number().positive(),
      unitPrice: z.number().nonnegative(),
      unit: z.string().optional(),
      taxCategory: z.string().optional(),
      taxRate: z.number().nonnegative(),
    }),
  ),
});

function normalizeArgs(args: z.infer<typeof createDraftInvoiceParameters>) {
  return {
    contactId: args.contactId,
    issueDate: args.issueDate,
    dueDate: args.dueDate ?? "",
    currencyCode: args.currencyCode ?? "EUR",
    usesInclusiveTax: args.usesInclusiveTax ?? false,
    notes: args.notes ?? "",
    terms: args.terms ?? "",
    internalNotes: args.internalNotes ?? "",
    items: args.items.map((item, index) => ({
      sortOrder: index,
      name: item.name,
      description: item.description ?? "",
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      unit: item.unit ?? "",
      taxCategory: item.taxCategory ?? "standard",
      taxRate: String(item.taxRate),
    })),
  };
}

function matchesConfirmation(
  confirmToolCall: ConfirmToolCall | undefined,
  toolName: string,
  args: unknown,
) {
  return (
    confirmToolCall?.approved === true &&
    confirmToolCall.toolName === toolName &&
    JSON.stringify(confirmToolCall.args) === JSON.stringify(args)
  );
}

function buildConfirmation(
  args: z.infer<typeof createDraftInvoiceParameters>,
): PendingConfirmation {
  return {
    confirmation: true,
    toolName: "createDraftInvoice",
    args,
    summary: {
      title: "Create draft invoice",
      details: [
        `Contact ID: ${args.contactId}`,
        `Issue date: ${args.issueDate}`,
        `Line items: ${args.items.length}`,
      ],
    },
  };
}

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Tool tests run outside Next's request cache context.
  }
}

export function createCreateDraftInvoiceTool(
  orgId: string,
  confirmToolCall?: ConfirmToolCall,
) {
  return tool({
    description: "Create a draft invoice after the user explicitly approves it.",
    parameters: zodSchema(createDraftInvoiceParameters),
    execute: async (rawArgs) => {
      const args = createDraftInvoiceParameters.parse(rawArgs);
      if (!matchesConfirmation(confirmToolCall, "createDraftInvoice", args)) {
        return buildConfirmation(args);
      }

      const { invoice } = await createDraftInvoice(orgId, normalizeArgs(args));
      safeRevalidate("/invoices");

      return {
        created: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
      };
    },
  });
}
