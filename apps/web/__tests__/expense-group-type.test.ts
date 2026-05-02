import { describe, it, expect } from "vitest";
import { EXPENSE_GROUPS_SEED } from "@opentab/db/schema";
import { GROUP_TYPE_MARKER } from "../lib/expenses/group-type";

describe("expense-group type mapping", () => {
  it("every seeded group has a non-null type value", () => {
    for (const g of EXPENSE_GROUPS_SEED) {
      expect(g.type, `group "${g.code}" missing type`).toBeTruthy();
    }
  });

  it("known operating-expense groups are tagged operating_expense", () => {
    const expected = [
      "rent",
      "utilities",
      "telecom",
      "office_supplies",
      "software",
      "hardware",
      "professional_services",
      "marketing",
      "travel",
      "transport",
      "insurance",
      "meals_entertainment",
      "bank_fees",
      "training",
      "salaries",
      "employee_benefits",
      "repairs_maintenance",
    ];
    for (const code of expected) {
      const g = EXPENSE_GROUPS_SEED.find((x) => x.code === code);
      expect(g, `missing group ${code}`).toBeDefined();
      expect(g?.type, `${code} should be operating_expense`).toBe(
        "operating_expense",
      );
    }
  });

  it("the purchases group is tagged as purchase (COGS)", () => {
    const g = EXPENSE_GROUPS_SEED.find((x) => x.code === "purchases");
    expect(g).toBeDefined();
    expect(g?.type).toBe("purchase");
  });

  it("taxes_contributions and other are tagged as other (below-operating)", () => {
    expect(
      EXPENSE_GROUPS_SEED.find((x) => x.code === "taxes_contributions")?.type,
    ).toBe("other");
    expect(EXPENSE_GROUPS_SEED.find((x) => x.code === "other")?.type).toBe(
      "other",
    );
  });

  it("exactly one group per unique code (no duplicates from the 4 new additions)", () => {
    const codes = EXPENSE_GROUPS_SEED.map((g) => g.code);
    const uniq = new Set(codes);
    expect(codes.length).toBe(uniq.size);
  });

  it("marker map covers all 4 type values", () => {
    const types: Array<keyof typeof GROUP_TYPE_MARKER> = [
      "operating_expense",
      "purchase",
      "asset",
      "other",
    ];
    for (const t of types) {
      expect(GROUP_TYPE_MARKER[t]).toBeTruthy();
    }
  });
});
