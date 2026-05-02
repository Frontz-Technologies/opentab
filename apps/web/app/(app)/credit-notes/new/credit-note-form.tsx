"use client";

import { useEffect, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Invoice } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { CurrencyCombobox } from "@/components/ui/currency-combobox";
import type { SupportedCurrencyCode } from "@/lib/currency/supported";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CREDIT_NOTE_REASON } from "@opentab/db/schema";
import { EmptyEntityHint } from "@/components/forms/empty-entity-hint";
import { createCreditNote } from "../actions";

interface ContactRow {
  id: string;
  displayName: string;
  email: string | null;
  vatNumber: string | null;
}

interface LineItem {
  sortOrder: number;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxCategory: string;
}

const newLine = (sortOrder: number): LineItem => ({
  sortOrder,
  name: "",
  description: "",
  quantity: "1",
  unitPrice: "0.00",
  taxRate: "24.00",
  taxCategory: "standard",
});

interface CreditNoteFormProps {
  contacts: ContactRow[];
  defaultCurrency: string;
  prefilledInvoice: Invoice | null;
}

export function CreditNoteForm({
  contacts,
  defaultCurrency,
  prefilledInvoice,
}: CreditNoteFormProps) {
  const t = useTranslations("creditNotes");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState<string>(
    prefilledInvoice?.contactId ?? contacts[0]?.id ?? "",
  );
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [reason, setReason] = useState<string>(CREDIT_NOTE_REASON.RETURN);
  const [reasonNote, setReasonNote] = useState("");
  const [items, setItems] = useState<LineItem[]>([newLine(0)]);

  const selectedContact = contacts.find((c) => c.id === contactId);

  const [rateInfo, setRateInfo] = useState<{
    rate: number;
    effectiveDate: string;
    staleFallback: boolean;
  } | null>(null);

  useEffect(() => {
    if (currencyCode === defaultCurrency || !issueDate) {
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/fx/preview?date=${encodeURIComponent(issueDate)}&from=${encodeURIComponent(currencyCode)}&to=${encodeURIComponent(defaultCurrency)}`,
          { signal: ctrl.signal },
        );
        if (r.ok) setRateInfo(await r.json());
        else setRateInfo(null);
      } catch {
        setRateInfo(null);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [currencyCode, issueDate, defaultCurrency]);

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, newLine(prev.length)]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContact) {
      toast.error(t("validationFailed"));
      return;
    }
    const formData = new FormData();
    formData.set("contactId", contactId);
    if (prefilledInvoice) formData.set("invoiceId", prefilledInvoice.id);
    formData.set("issueDate", issueDate);
    formData.set("currencyCode", currencyCode);
    formData.set("usesInclusiveTax", "false");
    formData.set("contactName", selectedContact.displayName);
    formData.set("contactEmail", selectedContact.email ?? "");
    formData.set("contactVatNumber", selectedContact.vatNumber ?? "");
    formData.set("reason", reason);
    formData.set("reasonNote", reasonNote);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      try {
        const result = await createCreditNote(formData);
        if (result.success && result.creditNote) {
          toast.success(t("created"));
          router.push(`/credit-notes/${result.creditNote.id}`);
        } else {
          toast.error(t("validationFailed"));
        }
      } catch (err) {
        if (err instanceof Error && /no rate available/i.test(err.message)) {
          toast.error(tCommon("rateUnavailable", { currency: currencyCode }));
          return;
        }
        throw err;
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-surface-container rounded-xl p-6"
    >
      {prefilledInvoice && (
        <p className="text-sm text-on-surface-variant">
          {t("creditingInvoice")}:{" "}
          <span className="font-mono">
            {prefilledInvoice.invoiceNumber ?? prefilledInvoice.id.slice(0, 8)}
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="cn-contactId"
            className="block text-sm font-label text-on-surface mb-1"
          >
            {t("client")}
          </label>
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
              <SelectTrigger id="cn-contactId" className="w-full">
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
        <div>
          <label
            htmlFor="cn-issueDate"
            className="block text-sm font-label text-on-surface mb-1"
          >
            {t("issueDate")}
          </label>
          <DatePicker
            value={issueDate ? parseISO(issueDate) : undefined}
            onChange={(d) => setIssueDate(d ? format(d, "yyyy-MM-dd") : "")}
            name="issueDate"
            ariaLabel={t("issueDate")}
          />
        </div>
        <div>
          <label className="block text-sm font-label text-on-surface mb-1">
            {tCommon("currencyPlaceholder")}
          </label>
          <CurrencyCombobox
            value={currencyCode as SupportedCurrencyCode}
            onChange={(v) => setCurrencyCode(v)}
            name="currencyCode"
            defaultCurrency={defaultCurrency as SupportedCurrencyCode}
          />
          {currencyCode !== defaultCurrency &&
            rateInfo &&
            !rateInfo.staleFallback && (
              <p className="text-on-surface-variant text-xs mt-1">
                {tCommon("rateHint", {
                  from: currencyCode,
                  to: defaultCurrency,
                  rate: rateInfo.rate.toFixed(4),
                  date: rateInfo.effectiveDate,
                })}
              </p>
            )}
          {currencyCode !== defaultCurrency && rateInfo?.staleFallback && (
            <p className="text-warning text-xs mt-1">
              {tCommon("rateHintStale", { date: rateInfo.effectiveDate })}
            </p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="cn-reason"
          className="block text-sm font-label text-on-surface mb-1"
        >
          {t("reason")}
        </label>
        <Select value={reason} onValueChange={(v) => setReason(v)}>
          <SelectTrigger id="cn-reason" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CREDIT_NOTE_REASON.RETURN}>
              {t("reasonReturn")}
            </SelectItem>
            <SelectItem value={CREDIT_NOTE_REASON.CORRECTION}>
              {t("reasonCorrection")}
            </SelectItem>
            <SelectItem value={CREDIT_NOTE_REASON.DISCOUNT}>
              {t("reasonDiscount")}
            </SelectItem>
            <SelectItem value={CREDIT_NOTE_REASON.OTHER}>
              {t("reasonOther")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label
          htmlFor="cn-reasonNote"
          className="block text-sm font-label text-on-surface mb-1"
        >
          {t("reasonNote")}
        </label>
        <Input
          id="cn-reasonNote"
          value={reasonNote}
          onChange={(e) => setReasonNote(e.target.value)}
          placeholder={t("reasonNotePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <h3 className="font-label text-sm text-on-surface mb-1">
          {t("lineItems")}
        </h3>
        {items.map((item, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[1fr_80px_120px_80px_auto] gap-2 items-center"
          >
            <Input
              id={`cn-item-name-${idx}`}
              aria-label={t("itemName")}
              placeholder={t("itemName")}
              value={item.name}
              onChange={(e) => updateItem(idx, { name: e.target.value })}
              required
            />
            <MoneyInput
              id={`cn-item-qty-${idx}`}
              aria-label={t("quantity")}
              decimalScale={4}
              value={item.quantity}
              onChange={(v) => updateItem(idx, { quantity: v })}
            />
            <MoneyInput
              id={`cn-item-price-${idx}`}
              aria-label={t("unitPrice")}
              decimalScale={2}
              value={item.unitPrice}
              onChange={(v) => updateItem(idx, { unitPrice: v })}
            />
            <MoneyInput
              id={`cn-item-tax-${idx}`}
              aria-label={t("taxRate")}
              decimalScale={2}
              value={item.taxRate}
              onChange={(v) => updateItem(idx, { taxRate: v })}
            />
            {items.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeItem(idx)}
                aria-label={t("removeItem")}
              >
                ×
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          + {t("addItem")}
        </Button>
      </div>

      <Button type="submit" disabled={isPending}>
        {t("save")}
      </Button>
    </form>
  );
}
