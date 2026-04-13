export type PeriodKey = "month" | "30days" | "quarter" | "year" | "all";

export type DateRange = { start: Date; end: Date };

export interface KpiData {
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  secondary: string;
}

export interface TimeBucketRow {
  bucket: string;
  total: number;
}

export interface RevenueByCientRow {
  contactId: string;
  displayName: string;
  invoiceCount: number;
  total: number;
}

export interface ExpenseByCategoryRow {
  categoryId: string;
  category: string;
  total: number;
  percentage: number;
}

export interface VatLineRow {
  rate: number;
  label: string;
  taxableBase: number;
  vatAmount: number;
}

export interface DashboardData {
  revenue: KpiData;
  expenses: KpiData;
  outstanding: KpiData;
  netProfit: KpiData;
  cashFlow: { revenue: TimeBucketRow[]; expenses: TimeBucketRow[] };
  revenueByClient: RevenueByCientRow[];
  expensesByCategory: ExpenseByCategoryRow[];
  period: PeriodKey;
}

export interface PnlReportData {
  revenue: {
    total: number;
    byClient: RevenueByCientRow[];
    byPeriod: TimeBucketRow[];
  };
  expenses: {
    total: number;
    byCategory: ExpenseByCategoryRow[];
  };
  netProfit: number;
  profitMargin: number;
  comparison: {
    revenueChange: number | null;
    expenseChange: number | null;
    profitChange: number | null;
  };
}

export interface VatReportData {
  output: VatLineRow[];
  input: VatLineRow[];
  totalOutput: number;
  totalInput: number;
  netPayable: number;
}
