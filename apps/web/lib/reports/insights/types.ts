import type {
  ExpenseByCategoryRow,
  RevenueByCientRow,
  PeriodKey,
} from "../types";

export interface InsightCard {
  id: string;
  type: "info" | "risk" | "success";
  // String identifier (lucide-react export name) — kept as a string because
  // these cards are produced server-side and serialized into the RSC payload
  // for the dashboard Client Component. Component references cannot cross
  // that boundary; clients resolve the icon via `<IconByName name=... />`.
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
