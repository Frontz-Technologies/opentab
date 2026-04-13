import { revalidatePath } from "next/cache";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { createDraftExpense } from "@/lib/expenses/draft-expenses";
import type { ConfirmToolCall, PendingConfirmation } from "@/lib/ai/types";

const createDraftExpenseParameters = z.object({
  contactId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  currencyCode: z.string().length(3).optional(),
  usesInclusiveTax: z.boolean().optional(),
  supplierInvoiceNumber: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      quantity: z.number().positive(),
      unitPrice: z.number().nonnegative(),
      taxRate: z.number().nonnegative(),
    }),
  ),
});

function normalizeArgs(args: z.infer<typeof createDraftExpenseParameters>) {
  return {
    contactId: args.contactId ?? "",
    categoryId: args.categoryId ?? "",
    expenseDate: args.expenseDate,
    paymentDate: args.paymentDate ?? "",
    currencyCode: args.currencyCode ?? "EUR",
    usesInclusiveTax: args.usesInclusiveTax ?? false,
    supplierInvoiceNumber: args.supplierInvoiceNumber ?? "",
    description: args.description ?? "",
    notes: args.notes ?? "",
    items: args.items.map((item, index) => ({
      sortOrder: index,
      name: item.name,
      description: item.description ?? "",
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
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
  args: z.infer<typeof createDraftExpenseParameters>,
): PendingConfirmation {
  return {
    confirmation: true,
    toolName: "createDraftExpense",
    args,
    summary: {
      title: "Create draft expense",
      details: [
        `Expense date: ${args.expenseDate}`,
        `Line items: ${args.items.length}`,
        args.contactId
          ? `Supplier ID: ${args.contactId}`
          : "No supplier linked",
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

export function createCreateDraftExpenseTool(
  orgId: string,
  confirmToolCall?: ConfirmToolCall,
) {
  return tool({
    description:
      "Create a draft expense after the user explicitly approves it.",
    parameters: zodSchema(createDraftExpenseParameters),
    execute: async (rawArgs) => {
      const args = createDraftExpenseParameters.parse(rawArgs);
      if (!matchesConfirmation(confirmToolCall, "createDraftExpense", args)) {
        return buildConfirmation(args);
      }

      const { expense } = await createDraftExpense(orgId, normalizeArgs(args));
      safeRevalidate("/expenses");

      return {
        created: true,
        expenseId: expense.id,
        expenseNumber: expense.expenseNumber,
        total: expense.total,
      };
    },
  });
}
