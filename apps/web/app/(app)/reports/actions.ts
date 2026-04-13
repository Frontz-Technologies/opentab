"use server";

import { z } from "zod";
import { getSession } from "@/lib/session";
import type { PnlReportData, VatReportData } from "@/lib/reports/types";
import { timeBucket } from "@/lib/reports/periods";
import {
  getRevenue,
  getRevenueByClient,
  getRevenueByPeriod,
  getExpenseTotal,
  getExpensesByCategory,
  getOutputVat,
  getInputVat,
} from "@/lib/reports/queries";
import { getCountryProvider } from "@/lib/country";
import { pnlToCsv } from "@/lib/reports/export/csv";
import type { OrgTaxSettings } from "@/lib/reports/tax/types";
import { organisations } from "@opentab/db";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";

const dateSchema = z.string().date();

export async function getPnlReport(
  startDate: string,
  endDate: string,
): Promise<PnlReportData> {
  dateSchema.parse(startDate);
  dateSchema.parse(endDate);

  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgId = session.org.id;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  const bucket = timeBucket("month");

  const [rev, revByClient, revByPeriod, exp, expByCat] = await Promise.all([
    getRevenue(orgId, start, end),
    getRevenueByClient(orgId, start, end),
    getRevenueByPeriod(orgId, start, end, bucket),
    getExpenseTotal(orgId, start, end),
    getExpensesByCategory(orgId, start, end),
  ]);

  const [prevRev, prevExp] = await Promise.all([
    getRevenue(orgId, prevStart, prevEnd),
    getExpenseTotal(orgId, prevStart, prevEnd),
  ]);

  const netProfit = rev.total - exp.total;
  const prevNetProfit = prevRev.total - prevExp.total;
  const profitMargin = rev.total > 0 ? (netProfit / rev.total) * 100 : 0;

  return {
    revenue: {
      total: rev.total,
      byClient: revByClient,
      byPeriod: revByPeriod,
    },
    expenses: {
      total: exp.total,
      byCategory: expByCat,
    },
    netProfit,
    profitMargin,
    comparison: {
      revenueChange:
        prevRev.total > 0
          ? Math.round(((rev.total - prevRev.total) / prevRev.total) * 1000) /
            10
          : null,
      expenseChange:
        prevExp.total > 0
          ? Math.round(((exp.total - prevExp.total) / prevExp.total) * 1000) /
            10
          : null,
      profitChange:
        prevNetProfit !== 0
          ? Math.round(
              ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 1000,
            ) / 10
          : null,
    },
  };
}

export async function exportPnlCsv(
  startDate: string,
  endDate: string,
): Promise<string> {
  const data = await getPnlReport(startDate, endDate);
  return pnlToCsv(data);
}

export async function getVatReport(
  startDate: string,
  endDate: string,
): Promise<VatReportData> {
  dateSchema.parse(startDate);
  dateSchema.parse(endDate);

  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const provider = getCountryProvider(session.org.countryCode);
  if (!provider.capabilities.vatReport) {
    throw new Error("VAT report not available for your country");
  }

  const orgId = session.org.id;
  const start = new Date(startDate);
  const end = new Date(endDate);

  const [output, input] = await Promise.all([
    getOutputVat(orgId, start, end),
    getInputVat(orgId, start, end),
  ]);

  // Map rate labels from provider's vatRates
  const rateLabels = new Map(
    provider.vatRates.map((vr) => [vr.rate, vr.label]),
  );
  const labeledOutput = output.map((row) => ({
    ...row,
    label: rateLabels.get(row.rate) ?? `${row.rate}%`,
  }));
  const labeledInput = input.map((row) => ({
    ...row,
    label: rateLabels.get(row.rate) ?? `${row.rate}%`,
  }));

  const totalOutput = output.reduce((s, r) => s + r.vatAmount, 0);
  const totalInput = input.reduce((s, r) => s + r.vatAmount, 0);

  return {
    output: labeledOutput,
    input: labeledInput,
    totalOutput,
    totalInput,
    netPayable: totalOutput - totalInput,
  };
}

export async function getTaxProjectionData(): Promise<{
  ytdRevenue: number;
  ytdExpenses: number;
  monthsElapsed: number;
  taxSettings: OrgTaxSettings | null;
}> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgId = session.org.id;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthsElapsed = now.getMonth() + 1;

  const [rev, exp] = await Promise.all([
    getRevenue(orgId, yearStart, now),
    getExpenseTotal(orgId, yearStart, now),
  ]);

  const [org] = await db
    .select({ taxSettings: organisations.taxSettings })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  return {
    ytdRevenue: rev.total,
    ytdExpenses: exp.total,
    monthsElapsed,
    taxSettings: (org?.taxSettings as OrgTaxSettings) ?? null,
  };
}
