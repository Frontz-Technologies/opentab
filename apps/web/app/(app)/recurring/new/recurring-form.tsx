"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Contact, Product } from "@opentab/db/schema";
import { FREQUENCY } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LineItemsBuilder,
  type LineItem,
} from "@/components/invoicing/line-items-builder";
import { createRecurring } from "../actions";

interface RecurringFormProps {
  contacts: Contact[];
  products: Product[];
  defaultCurrency: string;
  defaultTaxRate: string;
}

export function RecurringForm({
  contacts,
  products,
  defaultCurrency,
  defaultTaxRate,
}: RecurringFormProps) {
  const t = useTranslations("recurring");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [frequency, setFrequency] = useState(String(FREQUENCY.MONTHLY));
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [remainingCycles, setRemainingCycles] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [usesInclusiveTax, setUsesInclusiveTax] = useState(false);
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const frequencyOptions = [
    { value: FREQUENCY.DAILY, label: t("frequencyDaily") },
    { value: FREQUENCY.WEEKLY, label: t("frequencyWeekly") },
    { value: FREQUENCY.BIWEEKLY, label: t("frequencyBiweekly") },
    { value: FREQUENCY.MONTHLY, label: t("frequencyMonthly") },
    { value: FREQUENCY.QUARTERLY, label: t("frequencyQuarterly") },
    { value: FREQUENCY.BIANNUALLY, label: t("frequencyBiannually") },
    { value: FREQUENCY.ANNUALLY, label: t("frequencyAnnually") },
  ];

  function handleSubmit() {
    if (!contactId) {
      setError(t("selectClient"));
      return;
    }
    if (items.length === 0) {
      setError("At least one line item is required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("frequency", frequency);
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);
    formData.set("nextSendDate", startDate);
    formData.set("remainingCycles", remainingCycles);
    formData.set("autoSend", String(autoSend));
    formData.set("usesInclusiveTax", String(usesInclusiveTax));
    formData.set("currencyCode", currencyCode);
    formData.set("notes", notes);
    formData.set("terms", terms);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result = await createRecurring(formData);
      if (result.success) {
        router.push("/recurring");
      } else {
        setError(JSON.stringify(result.error));
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {error && (
        <div className="bg-red-500/10 text-red-400 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          {t("client")}
        </h2>
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
        >
          <option value="">{t("selectClient")}</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          Schedule
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("frequency")}
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
            >
              {frequencyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("startDate")}
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("endDate")}
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <p className="text-xs text-on-surface/40 mt-1">
              {t("endDateHelp")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("remainingCycles")}
            </label>
            <Input
              type="number"
              value={remainingCycles}
              onChange={(e) => setRemainingCycles(e.target.value)}
              min="0"
            />
            <p className="text-xs text-on-surface/40 mt-1">
              {t("remainingCyclesHelp")}
            </p>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input
                type="checkbox"
                checked={autoSend}
                onChange={(e) => setAutoSend(e.target.checked)}
                className="rounded"
              />
              {t("autoSend")}
            </label>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input
                type="checkbox"
                checked={usesInclusiveTax}
                onChange={(e) => setUsesInclusiveTax(e.target.checked)}
                className="rounded"
              />
              Prices include tax
            </label>
          </div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-6">
        <LineItemsBuilder
          items={items}
          onChange={setItems}
          products={products}
          defaultTaxRate={defaultTaxRate}
          usesInclusiveTax={usesInclusiveTax}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Saving..." : t("save")}
        </Button>
      </div>
    </div>
  );
}
