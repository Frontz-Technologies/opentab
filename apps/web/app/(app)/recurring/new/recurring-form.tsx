"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Contact, Product } from "@opentab/db/schema";
import { FREQUENCY } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineItemsBuilder,
  type LineItem,
} from "@/components/invoicing/line-items-builder";
import { EmptyEntityHint } from "@/components/forms/empty-entity-hint";
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
  const tInv = useTranslations("invoices");
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
        <div
          role="alert"
          className="bg-error/10 text-error rounded-lg p-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          {t("client")}
        </h2>
        {contacts.length === 0 ? (
          <EmptyEntityHint
            message={t("noClientsYet")}
            ctaLabel={t("createContact")}
            ctaHref="/contacts/new"
          />
        ) : (
          <Select
            value={contactId || undefined}
            onValueChange={(v) => setContactId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectClient")} />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
            <Select value={frequency} onValueChange={(v) => setFrequency(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("startDate")}
            </label>
            <DatePicker
              value={startDate ? parseISO(startDate) : undefined}
              onChange={(d) => setStartDate(d ? format(d, "yyyy-MM-dd") : "")}
              ariaLabel={t("startDate")}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("endDate")}
            </label>
            <DatePicker
              value={endDate ? parseISO(endDate) : undefined}
              onChange={(d) => setEndDate(d ? format(d, "yyyy-MM-dd") : "")}
              ariaLabel={t("endDate")}
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
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="font-headline text-lg font-semibold text-on-surface">
            {t("lineItems")} <span className="text-tertiary">*</span>
          </h2>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={usesInclusiveTax}
              onChange={(e) => setUsesInclusiveTax(e.target.checked)}
              className="rounded"
            />
            {tInv("inclusiveTax")}
          </label>
        </div>
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
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
