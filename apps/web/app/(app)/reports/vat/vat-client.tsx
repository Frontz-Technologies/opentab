"use client";

import { useState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { VatReportData } from "@/lib/reports/types";
import { getVatReport } from "../actions";

type Preset = "month" | "lastMonth" | "quarter" | "year";

function formatEur(n: number): string {
  return `€${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const [activePreset, setActivePreset] = useState<Preset | null>("month");

  useEffect(() => {
    startTransition(async () => {
      const result = await getVatReport(startDate, endDate);
      setData(result);
    });
  }, [startDate, endDate]);

  const setPreset = (preset: Preset) => {
    const now = new Date();
    let s: Date;
    let e: Date;
    switch (preset) {
      case "month":
        s = new Date(now.getFullYear(), now.getMonth(), 1);
        e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "lastMonth":
        s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        e = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "quarter": {
        const q = Math.floor(now.getMonth() / 3);
        s = new Date(now.getFullYear(), q * 3, 1);
        e = new Date(now.getFullYear(), q * 3 + 3, 0);
        break;
      }
      case "year":
        s = new Date(now.getFullYear(), 0, 1);
        e = new Date(now.getFullYear(), 11, 31);
        break;
    }
    setActivePreset(preset);
    setStartDate(s.toISOString().slice(0, 10));
    setEndDate(e.toISOString().slice(0, 10));
  };

  const handleDateChange = (setter: (v: string) => void, value: string) => {
    setActivePreset(null);
    setter(value);
  };

  const presets: { key: Preset; label: string }[] = [
    { key: "month", label: t("periodMonth") },
    { key: "lastMonth", label: t("periodLastMonth") },
    { key: "quarter", label: t("periodQuarter") },
    { key: "year", label: t("periodYear") },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleDateChange(setStartDate, e.target.value)}
          className="bg-surface-container-lowest rounded-lg px-3 py-2 text-sm text-on-surface"
        />
        <span className="text-on-surface-variant text-sm">{t("dateTo")}</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => handleDateChange(setEndDate, e.target.value)}
          className="bg-surface-container-lowest rounded-lg px-3 py-2 text-sm text-on-surface"
        />
        <div className="flex gap-1 ml-auto">
          {presets.map(({ key, label }) => {
            const active = activePreset === key;
            return (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-label uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-primary-container/20 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {data && (
        <div className={isPending ? "opacity-60 transition-opacity" : ""}>
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
