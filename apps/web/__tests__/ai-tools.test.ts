import { beforeEach, describe, expect, it, vi } from "vitest";

const getRevenueMock = vi.fn();
const getRevenueByClientMock = vi.fn();
const getExpenseTotalMock = vi.fn();
const getExpensesByCategoryMock = vi.fn();
const getOutputVatMock = vi.fn();
const getInputVatMock = vi.fn();
const getOutstandingMock = vi.fn();

vi.mock("@/lib/reports/queries", () => ({
  getRevenue: getRevenueMock,
  getRevenueByClient: getRevenueByClientMock,
  getExpenseTotal: getExpenseTotalMock,
  getExpensesByCategory: getExpensesByCategoryMock,
  getOutputVat: getOutputVatMock,
  getInputVat: getInputVatMock,
  getOutstanding: getOutstandingMock,
}));

describe("AI tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("builds report-backed read tools", async () => {
    getRevenueMock.mockResolvedValue({ total: 24800, count: 12 });
    getRevenueByClientMock.mockResolvedValue([
      { displayName: "Acme Corp", total: 8400 },
      { displayName: "TechStart GmbH", total: 6200 },
    ]);
    getExpenseTotalMock.mockResolvedValue({ total: 9000, count: 6 });
    getExpensesByCategoryMock.mockResolvedValue([
      { category: "Software", total: 5000 },
      { category: "Travel", total: 4000 },
    ]);
    getOutputVatMock.mockResolvedValue([
      { rate: 24, vatAmount: 1200, taxableBase: 5000, label: "24%" },
    ]);
    getInputVatMock.mockResolvedValue([
      { rate: 24, vatAmount: 600, taxableBase: 2500, label: "24%" },
    ]);
    getOutstandingMock.mockResolvedValue({
      total: 3000,
      overdueTotal: 1200,
      count: 4,
      overdueCount: 2,
    });

    const { createTools } = await import("@/lib/ai/tools");
    const tools = createTools("org-1");

    expect(tools).toHaveProperty("getRevenueSummary");
    expect(tools).toHaveProperty("getExpenseSummary");
    expect(tools).toHaveProperty("getVatSummary");
    expect(tools).toHaveProperty("getOutstandingInvoices");

    const revenue = (await tools.getRevenueSummary.execute(
      { period: "year", year: 2026 },
      { toolCallId: "tool-1", messages: [] },
    )) as {
      total: number;
      invoiceCount: number;
      topClients: Array<{ name: string; total: number }>;
    };
    const expenses = (await tools.getExpenseSummary.execute(
      { period: "year", year: 2026 },
      { toolCallId: "tool-2", messages: [] },
    )) as {
      total: number;
      expenseCount: number;
      byCategory: Array<{ category: string; total: number }>;
    };
    const vat = (await tools.getVatSummary.execute(
      { period: "year", year: 2026 },
      { toolCallId: "tool-3", messages: [] },
    )) as {
      outputVat: number;
      inputVat: number;
      netPayable: number;
    };
    const outstanding = (await tools.getOutstandingInvoices.execute(
      { daysOverdue: 30 },
      { toolCallId: "tool-4", messages: [] },
    )) as {
      totalOutstanding: number;
      count: number;
      overdueCount: number;
    };

    expect(revenue).toMatchObject({
      total: 24800,
      invoiceCount: 12,
    });
    expect(revenue.topClients).toEqual(
      expect.arrayContaining([{ name: "Acme Corp", total: 8400 }]),
    );
    expect(expenses).toMatchObject({
      total: 9000,
      expenseCount: 6,
    });
    expect(expenses.byCategory).toEqual(
      expect.arrayContaining([{ category: "Software", total: 5000 }]),
    );
    expect(vat).toMatchObject({
      outputVat: 1200,
      inputVat: 600,
      netPayable: 600,
    });
    expect(outstanding).toMatchObject({
      totalOutstanding: 3000,
      count: 4,
      overdueCount: 2,
    });
  });
});
