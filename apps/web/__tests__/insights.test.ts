import { describe, it, expect } from "vitest";
import type { InsightContext } from "../lib/reports/insights/types";
import { revenueTrendInsight } from "../lib/reports/insights/revenue-trend";
import { overdueInvoicesInsight } from "../lib/reports/insights/overdue-invoices";
import { topClientInsight } from "../lib/reports/insights/top-client";
import { expenseSpikeInsight } from "../lib/reports/insights/expense-spike";
import { generateInsights } from "../lib/reports/insights/index";

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    revenue: { total: 10000, previousTotal: 8000 },
    expenses: {
      total: 3000,
      previousTotal: 2500,
      byCategory: [],
    },
    outstanding: { total: 0, overdueTotal: 0, overdueCount: 0 },
    revenueByClient: [],
    countryCode: null,
    period: "month",
    ...overrides,
  };
}

describe("revenueTrendInsight", () => {
  it("returns success card when revenue up 15%", () => {
    const card = revenueTrendInsight(
      makeCtx({ revenue: { total: 11500, previousTotal: 10000 } }),
    );
    expect(card).not.toBeNull();
    expect(card!.type).toBe("success");
    expect(card!.icon).toBe("TrendingUp");
  });

  it("returns warning card when revenue down 12%", () => {
    const card = revenueTrendInsight(
      makeCtx({ revenue: { total: 8800, previousTotal: 10000 } }),
    );
    expect(card).not.toBeNull();
    expect(card!.type).toBe("risk");
  });

  it("returns null when change < 10%", () => {
    const card = revenueTrendInsight(
      makeCtx({ revenue: { total: 10500, previousTotal: 10000 } }),
    );
    expect(card).toBeNull();
  });

  it("returns null when no previous data", () => {
    const card = revenueTrendInsight(
      makeCtx({ revenue: { total: 10000, previousTotal: null } }),
    );
    expect(card).toBeNull();
  });
});

describe("overdueInvoicesInsight", () => {
  it("returns warning when overdueCount > 0", () => {
    const card = overdueInvoicesInsight(
      makeCtx({
        outstanding: {
          total: 5000,
          overdueTotal: 3000,
          overdueCount: 3,
        },
      }),
    );
    expect(card).not.toBeNull();
    expect(card!.type).toBe("risk");
    expect(card!.action?.href).toBe("/invoices?filter=overdue");
  });

  it("returns null when no overdue", () => {
    const card = overdueInvoicesInsight(
      makeCtx({
        outstanding: {
          total: 5000,
          overdueTotal: 0,
          overdueCount: 0,
        },
      }),
    );
    expect(card).toBeNull();
  });
});

describe("topClientInsight", () => {
  it("returns info when one client is 60% of revenue", () => {
    const card = topClientInsight(
      makeCtx({
        revenue: { total: 10000, previousTotal: null },
        revenueByClient: [
          {
            contactId: "c1",
            displayName: "Big Corp",
            total: 6000,
            invoiceCount: 3,
          },
          {
            contactId: "c2",
            displayName: "Small LLC",
            total: 4000,
            invoiceCount: 2,
          },
        ],
      }),
    );
    expect(card).not.toBeNull();
    expect(card!.type).toBe("info");
    expect(card!.description).toContain("Big Corp");
    expect(card!.description).toContain("60%");
  });

  it("returns null when max client is 40%", () => {
    const card = topClientInsight(
      makeCtx({
        revenue: { total: 10000, previousTotal: null },
        revenueByClient: [
          {
            contactId: "c1",
            displayName: "A",
            total: 4000,
            invoiceCount: 2,
          },
          {
            contactId: "c2",
            displayName: "B",
            total: 3000,
            invoiceCount: 2,
          },
          {
            contactId: "c3",
            displayName: "C",
            total: 3000,
            invoiceCount: 1,
          },
        ],
      }),
    );
    expect(card).toBeNull();
  });
});

describe("expenseSpikeInsight", () => {
  it("returns warning when one category is 3x average", () => {
    const card = expenseSpikeInsight(
      makeCtx({
        expenses: {
          total: 5000,
          previousTotal: null,
          byCategory: [
            {
              categoryId: "1",
              category: "Software",
              total: 5000,
              percentage: 71,
            },
            {
              categoryId: "2",
              category: "Travel",
              total: 1000,
              percentage: 17,
            },
            {
              categoryId: "3",
              category: "Office",
              total: 1000,
              percentage: 17,
            },
          ],
        },
      }),
    );
    expect(card).not.toBeNull();
    expect(card!.type).toBe("risk");
    expect(card!.description).toContain("Software");
  });

  it("returns null when categories are balanced", () => {
    const card = expenseSpikeInsight(
      makeCtx({
        expenses: {
          total: 3000,
          previousTotal: null,
          byCategory: [
            {
              categoryId: "1",
              category: "A",
              total: 1000,
              percentage: 33,
            },
            {
              categoryId: "2",
              category: "B",
              total: 1000,
              percentage: 33,
            },
            {
              categoryId: "3",
              category: "C",
              total: 1000,
              percentage: 33,
            },
          ],
        },
      }),
    );
    expect(card).toBeNull();
  });
});

describe("InsightCard.icon shape", () => {
  // Insights cards are produced server-side and serialised into the RSC
  // payload for the dashboard Client Component. Component references
  // (`LucideIcon`) cannot cross that boundary — the runtime throws
  // "Only plain objects can be passed to Client Components from Server
  // Components". Each builder must therefore emit a string identifier
  // for the icon, which the client resolves via `<IconByName />`.
  it("every produced insight has a non-empty string icon (not a function)", () => {
    // A context that triggers every builder at least once across
    // a few configurations. Country GR enables vatReport + taxProjection.
    const trippyCtx: InsightContext = {
      revenue: { total: 12000, previousTotal: 10000 },
      expenses: {
        total: 5000,
        previousTotal: null,
        byCategory: [
          {
            categoryId: "1",
            category: "Software",
            total: 5000,
            percentage: 71,
          },
          { categoryId: "2", category: "Travel", total: 1000, percentage: 17 },
          { categoryId: "3", category: "Office", total: 1000, percentage: 17 },
        ],
      },
      outstanding: { total: 5000, overdueTotal: 3000, overdueCount: 3 },
      revenueByClient: [
        {
          contactId: "c1",
          displayName: "Big Corp",
          total: 7000,
          invoiceCount: 3,
        },
        {
          contactId: "c2",
          displayName: "Small LLC",
          total: 5000,
          invoiceCount: 2,
        },
      ],
      countryCode: "GR",
      period: "month",
    };
    const cards = generateInsights(trippyCtx);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(typeof card.icon).toBe("string");
      expect(card.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("generateInsights", () => {
  it("sorts warnings before info before success", () => {
    const ctx = makeCtx({
      revenue: { total: 12000, previousTotal: 10000 },
      outstanding: {
        total: 5000,
        overdueTotal: 3000,
        overdueCount: 2,
      },
      revenueByClient: [
        {
          contactId: "c1",
          displayName: "Big",
          total: 7000,
          invoiceCount: 3,
        },
      ],
    });
    const insights = generateInsights(ctx);
    const types = insights.map((i) => i.type);
    // All risks come before info and success
    const firstInfo = types.indexOf("info");
    const lastRisk = types.lastIndexOf("risk");
    const firstSuccess = types.indexOf("success");
    if (lastRisk >= 0 && firstInfo >= 0) {
      expect(lastRisk).toBeLessThan(firstInfo);
    }
    if (firstInfo >= 0 && firstSuccess >= 0) {
      expect(firstInfo).toBeLessThan(firstSuccess);
    }
  });
});
