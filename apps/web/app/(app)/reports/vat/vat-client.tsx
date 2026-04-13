"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { VatReportData } from "@/lib/reports/types";
import { getVatReport } from "../actions";

function formatEur(n: number): string {
  return `\u20AC${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function VatClient({
  defaultStart,
  defaultEnd,
}: {
  defaultStart: string;
  defaultEnd: string;
}) {
  const t = useTranslations("reports");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [data, setData] = useState<VatReportData | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadReport = () => {
    startTransition(async () => {
      const result = await getVatReport(startDate, endDate);
      setData(result);
    });
  };

  const setQuarter = (q: number) => {
    const year = new Date().getFullYear();
    setStartDate(new Date(year, q * 3, 1).toISOString().slice(0, 10));
    setEndDate(new Date(year, q * 3 + 3, 0).toISOString().slice(0, 10));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-surface-container rounded-lg px-3 py-2 text-sm text-on-surface border border-outline-variant/20"
        />
        <span className="text-on-surface-variant">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-surface-container rounded-lg px-3 py-2 text-sm text-on-surface border border-outline-variant/20"
        />
        <button
          onClick={loadReport}
          disabled={isPending}
          className="px-4 py-2 rounded-lg btn-gradient text-on-primary font-bold text-sm"
        >
          {t("title")}
        </button>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((q) => (
            <button
              key={q}
              onClick={() => setQuarter(q)}
              className="px-3 py-1.5 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-low"
            >
              Q{q + 1}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className={isPending ? "opacity-60" : ""}>
          {/* Output VAT */}
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 mb-6">
            <h3 className="font-label text-sm text-on-surface-variant mb-4">
              {t("outputVat")}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-xs uppercase tracking-widest border-b border-outline-variant/10">
                  <th className="text-left py-2">{t("rate")}</th>
                  <th className="text-right py-2">{t("taxableBase")}</th>
                  <th className="text-right py-2">{t("vatAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {data.output.map((row) => (
                  <tr
                    key={row.rate}
                    className="border-b border-outline-variant/5"
                  >
                    <td className="py-2 text-on-surface">{row.label}</td>
                    <td className="py-2 text-right font-mono text-on-surface">
                      {formatEur(row.taxableBase)}
                    </td>
                    <td className="py-2 text-right font-mono text-on-surface">
                      {formatEur(row.vatAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 text-on-surface">{t("total")}</td>
                  <td />
                  <td className="py-2 text-right font-mono text-on-surface">
                    {formatEur(data.totalOutput)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Input VAT */}
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 mb-6">
            <h3 className="font-label text-sm text-on-surface-variant mb-4">
              {t("inputVat")}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-xs uppercase tracking-widest border-b border-outline-variant/10">
                  <th className="text-left py-2">{t("rate")}</th>
                  <th className="text-right py-2">{t("taxableBase")}</th>
                  <th className="text-right py-2">{t("vatAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {data.input.map((row) => (
                  <tr
                    key={row.rate}
                    className="border-b border-outline-variant/5"
                  >
                    <td className="py-2 text-on-surface">{row.label}</td>
                    <td className="py-2 text-right font-mono text-on-surface">
                      {formatEur(row.taxableBase)}
                    </td>
                    <td className="py-2 text-right font-mono text-on-surface">
                      {formatEur(row.vatAmount)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 text-on-surface">{t("total")}</td>
                  <td />
                  <td className="py-2 text-right font-mono text-on-surface">
                    {formatEur(data.totalInput)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net Payable */}
          <div
            className={`rounded-2xl p-6 border text-center ${
              data.netPayable > 0
                ? "bg-red-500/10 border-red-500/30"
                : "bg-emerald-500/10 border-emerald-500/30"
            }`}
          >
            <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-2">
              {data.netPayable > 0 ? t("netPayable") : t("vatRefund")}
            </p>
            <p className="text-3xl font-bold text-on-surface">
              {formatEur(Math.abs(data.netPayable))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
