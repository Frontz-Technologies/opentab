import { describe, it, expect } from "vitest";
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseLineItemSchema,
} from "@/lib/entities/expense";

const validLineItem = {
  sortOrder: 0,
  name: "Coffee",
  quantity: "1",
  unitPrice: "3.50",
  taxRate: "24.00",
};

const validExpense = {
  categoryId: "11111111-1111-1111-1111-111111111111",
  expenseDate: "2026-04-20",
  items: [validLineItem],
};

describe("expense entity schemas", () => {
  it("createExpenseSchema accepts a minimal valid payload", () => {
    const parsed = createExpenseSchema.safeParse(validExpense);
    expect(parsed.success).toBe(true);
  });

  it("createExpenseSchema rejects when items array is empty", () => {
    const parsed = createExpenseSchema.safeParse({
      ...validExpense,
      items: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("updateExpenseSchema matches createExpenseSchema behaviour", () => {
    expect(updateExpenseSchema.safeParse(validExpense).success).toBe(true);
  });

  it("expenseLineItemSchema rejects non-numeric unitPrice", () => {
    const parsed = expenseLineItemSchema.safeParse({
      ...validLineItem,
      unitPrice: "free",
    });
    expect(parsed.success).toBe(false);
  });
});
