"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  Contact,
  ExpenseCategory,
  ExpenseGroup,
} from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LineItemsBuilder,
  type LineItem,
} from "@/components/invoicing/line-items-builder";
import { createRecurringExpense } from "../actions";

interface RecurringExpenseFormProps {
  contacts: Contact[];
  groups: ExpenseGroup[];
  categories: ExpenseCategory[];
  defaultCurrency: string;
  defaultTaxRate: string;
}

export function RecurringExpenseForm({
  contacts,
  groups,
  categories,
  defaultCurrency,
  defaultTaxRate,
}: RecurringExpenseFormProps) {
  const t = useTranslations("recurringExpenses");
  const tExp = useTranslations("expenses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState("4"); // Monthly
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [remainingCycles, setRemainingCycles] = useState("");
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [usesInclusiveTax, setUsesInclusiveTax] = useState(false);
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const groupedCategories = groups.map((group) => ({
    group,
    items: categories.filter((c) => c.groupCode === group.code),
  }));

  function handleSubmit() {
    if (items.length === 0) {
      setError(tExp("itemRequired"));
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("categoryId", categoryId);
    formData.set("frequency", frequency);
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);
    formData.set("nextRunDate", startDate);
    formData.set("remainingCycles", remainingCycles);
    formData.set("autoConfirm", String(autoConfirm));
    formData.set("usesInclusiveTax", String(usesInclusiveTax));
    formData.set("currencyCode", currencyCode);
    formData.set("description", description);
    formData.set("notes", notes);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result = await createRecurringExpense(formData);
      if (result.success) {
        router.push("/recurring-expenses");
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
          {tExp("supplier")}
        </h2>
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
        >
          <option value="">{tExp("selectSupplier")}</option>
          {contacts
            .filter((c) => c.type === "supplier" || c.type === "both")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
        </select>
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          {tExp("details")}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {tExp("category")}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
            >
              <option value="">{tExp("selectCategory")}</option>
              {groupedCategories
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <optgroup key={g.group.code} label={g.group.nameEn}>
                    {g.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("frequency")}
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
            >
              <option value="1">{t("frequencyDaily")}</option>
              <option value="2">{t("frequencyWeekly")}</option>
              <option value="3">{t("frequencyBiweekly")}</option>
              <option value="4">{t("frequencyMonthly")}</option>
              <option value="5">{t("frequencyQuarterly")}</option>
              <option value="6">{t("frequencyBiannually")}</option>
              <option value="7">{t("frequencyAnnually")}</option>
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
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("remainingCycles")}
            </label>
            <Input
              type="number"
              min={0}
              value={remainingCycles}
              onChange={(e) => setRemainingCycles(e.target.value)}
              placeholder={t("remainingCyclesHelp")}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {tExp("currency")}
            </label>
            <Input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              maxLength={3}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="rounded"
              />
              {t("autoConfirm")}
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
              {tExp("inclusiveTax")}
            </label>
          </div>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-6">
        <LineItemsBuilder
          items={items}
          onChange={setItems}
          products={[]}
          defaultTaxRate={defaultTaxRate}
          usesInclusiveTax={usesInclusiveTax}
        />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-label text-on-surface/60 mb-1">
            {tExp("description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
          />
        </div>
        <div>
          <label className="block text-sm font-label text-on-surface/60 mb-1">
            {tExp("notes")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? tExp("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
