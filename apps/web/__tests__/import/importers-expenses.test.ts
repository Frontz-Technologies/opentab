import { describe, it, expect } from "vitest";
import { expensesImporter } from "../../lib/import/importers/expenses";

describe("expenses importer descriptor (#215)", () => {
  it("requires expenseDate + total", () => {
    const r = expensesImporter.rowSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("accepts a minimum-viable row (date + total)", () => {
    const r = expensesImporter.rowSchema.safeParse({
      expenseDate: "2026-04-25",
      total: "100.00",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { currencyCode: string }).currencyCode).toBe("EUR");
    }
  });

  it("idempotency key includes date + total + supplier hint + number", () => {
    const k = expensesImporter.idempotencyKeyParts(
      {
        expenseDate: "2026-04-25",
        total: "100.00",
        supplierName: "AWS",
        expenseNumber: "EXP-0001",
      } as never,
      "org-1",
    );
    const joined = k.join("|");
    expect(joined).toContain("2026-04-25");
    expect(joined).toContain("100.00");
    expect(joined).toContain("aws");
    expect(joined).toContain("EXP-0001");
  });
});
