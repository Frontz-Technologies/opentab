import type {
  ExpenseByCategoryRow,
  RevenueByCientRow,
  PeriodKey,
} from "../types";

export interface InsightCard {
  id: string;
  type: "info" | "warning" | "success";
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export interface InsightContext {
  revenue: { total: number; previousTotal: number | null };
  expenses: {
    total: number;
    previousTotal: number | null;
    byCategory: ExpenseByCategoryRow[];
  };
  outstanding: {
    total: number;
    overdueTotal: number;
    overdueCount: number;
  };
  revenueByClient: RevenueByCientRow[];
  countryCode: string | null;
  period: PeriodKey;
}
