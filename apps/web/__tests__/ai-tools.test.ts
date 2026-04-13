import { beforeEach, describe, expect, it, vi } from "vitest";

const getRevenueMock = vi.fn();
const getRevenueByClientMock = vi.fn();
const getExpenseTotalMock = vi.fn();
const getExpensesByCategoryMock = vi.fn();
const getOutputVatMock = vi.fn();
const getInputVatMock = vi.fn();
const getOutstandingMock = vi.fn();
const createDraftInvoiceMock = vi.fn();
const createDraftExpenseMock = vi.fn();

vi.mock("@/lib/reports/queries", () => ({
  getRevenue: getRevenueMock,
  getRevenueByClient: getRevenueByClientMock,
  getExpenseTotal: getExpenseTotalMock,
  getExpensesByCategory: getExpensesByCategoryMock,
  getOutputVat: getOutputVatMock,
  getInputVat: getInputVatMock,
  getOutstanding: getOutstandingMock,
}));

vi.mock("@/lib/invoicing/draft-invoices", () => ({
  createDraftInvoice: createDraftInvoiceMock,
}));

vi.mock("@/lib/expenses/draft-expenses", () => ({
  createDraftExpense: createDraftExpenseMock,
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
    const tools = createTools("org-1", { role: "owner" });

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

  it("exposes write tools only for non-accountant roles", async () => {
    const { createTools } = await import("@/lib/ai/tools");

    const ownerTools = createTools("org-1", { role: "owner" });
    const accountantTools = createTools("org-1", { role: "accountant" });

    expect(ownerTools).toHaveProperty("createDraftInvoice");
    expect(ownerTools).toHaveProperty("createDraftExpense");
    expect(accountantTools).not.toHaveProperty("createDraftInvoice");
    expect(accountantTools).not.toHaveProperty("createDraftExpense");
  });

  it("returns a confirmation payload before executing a write tool", async () => {
    const { createTools } = await import("@/lib/ai/tools");
    const tools = createTools("org-1", { role: "owner" });

    const result = await (tools as any).createDraftInvoice.execute(
      {
        contactId: "11111111-1111-4111-8111-111111111111",
        issueDate: "2026-04-13",
        items: [
          {
            name: "Development",
            quantity: 1,
            unitPrice: 100,
            taxRate: 24,
          },
        ],
      },
      { toolCallId: "tool-1", messages: [] },
    );

    expect(result).toMatchObject({
      confirmation: true,
      toolName: "createDraftInvoice",
    });
    expect(createDraftInvoiceMock).not.toHaveBeenCalled();
  });

  it("executes the confirmed write tool when approval matches", async () => {
    createDraftInvoiceMock.mockResolvedValue({
      invoice: {
        id: "invoice-1",
        invoiceNumber: "INV-0001",
        total: "124.00",
      },
    });

    const { createTools } = await import("@/lib/ai/tools");
    const tools = createTools("org-1", {
      role: "owner",
      confirmToolCall: {
        approved: true,
        toolName: "createDraftInvoice",
        args: {
          contactId: "11111111-1111-4111-8111-111111111111",
          issueDate: "2026-04-13",
          items: [
            {
              name: "Development",
              quantity: 1,
              unitPrice: 100,
              taxRate: 24,
            },
          ],
        },
      },
    });

    const result = await (tools as any).createDraftInvoice.execute(
      {
        contactId: "11111111-1111-4111-8111-111111111111",
        issueDate: "2026-04-13",
        items: [
          {
            name: "Development",
            quantity: 1,
            unitPrice: 100,
            taxRate: 24,
          },
        ],
      },
      { toolCallId: "tool-2", messages: [] },
    );

    expect(createDraftInvoiceMock).toHaveBeenCalledWith("org-1", {
      contactId: "11111111-1111-4111-8111-111111111111",
      issueDate: "2026-04-13",
      dueDate: "",
      currencyCode: "EUR",
      usesInclusiveTax: false,
      notes: "",
      terms: "",
      internalNotes: "",
      items: [
        {
          sortOrder: 0,
          name: "Development",
          description: "",
          quantity: "1",
          unitPrice: "100",
          unit: "",
          taxCategory: "standard",
          taxRate: "24",
        },
      ],
    });
    expect(result).toMatchObject({
      created: true,
      invoiceId: "invoice-1",
      invoiceNumber: "INV-0001",
    });
  });
});
