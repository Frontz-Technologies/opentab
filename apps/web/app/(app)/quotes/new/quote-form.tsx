"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Contact, Product } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  LineItemsBuilder,
  type LineItem,
} from "@/components/invoicing/line-items-builder";
import { EmptyEntityHint } from "@/components/forms/empty-entity-hint";
import { RequiredFieldsHint } from "@/components/forms/required-fields-hint";
import { createQuote } from "../actions";

interface QuoteFormProps {
  contacts: Contact[];
  products: Product[];
  defaultCurrency: string;
  defaultTaxRate: string;
}

export function QuoteForm({
  contacts,
  products,
  defaultCurrency,
  defaultTaxRate,
}: QuoteFormProps) {
  const t = useTranslations("quotes");
  const tInv = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [validUntil, setValidUntil] = useState("");
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [usesInclusiveTax, setUsesInclusiveTax] = useState(false);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    formData.set("issueDate", issueDate);
    formData.set("validUntil", validUntil);
    formData.set("currencyCode", currencyCode);
    formData.set("usesInclusiveTax", String(usesInclusiveTax));
    formData.set("contactName", selectedContact?.displayName ?? "");
    formData.set("contactEmail", selectedContact?.email ?? "");
    formData.set("contactVatNumber", selectedContact?.vatNumber ?? "");
    formData.set(
      "contactAddress",
      [
        selectedContact?.addressLine1,
        selectedContact?.addressLine2,
        selectedContact?.city,
        selectedContact?.postalCode,
      ]
        .filter(Boolean)
        .join(", "),
    );
    formData.set("notes", notes);
    formData.set("terms", terms);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      try {
        const result = await createQuote(formData);
        if (result.success) {
          router.push("/quotes");
        } else {
          setError(JSON.stringify(result.error));
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
          {t("client")} <span className="text-tertiary">*</span>
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
            onValueChange={(v) => {
              const next = v;
              setContactId(next);
              const contact = contacts.find((c) => c.id === next);
              if (contact?.defaultCurrency)
                setCurrencyCode(contact.defaultCurrency);
            }}
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
          Details
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("issueDate")} <span className="text-tertiary">*</span>
            </label>
            <DatePicker
              value={issueDate ? parseISO(issueDate) : undefined}
              onChange={(d) => setIssueDate(d ? format(d, "yyyy-MM-dd") : "")}
              name="issueDate"
              ariaLabel={t("issueDate")}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("validUntil")}
            </label>
            <DatePicker
              value={validUntil ? parseISO(validUntil) : undefined}
              onChange={(d) => setValidUntil(d ? format(d, "yyyy-MM-dd") : "")}
              name="validUntil"
              ariaLabel={t("validUntil")}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              Currency
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
      </div>

      <div className="bg-surface-container rounded-xl p-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-lg font-semibold text-on-surface">
              {t("lineItems")} <span className="text-tertiary">*</span>
            </h2>
            {items.length === 0 && (
              <p className="text-sm text-on-surface/50">{t("itemRequired")}</p>
            )}
          </div>
          <label
            htmlFor="usesInclusiveTax"
            className="flex items-center gap-2 text-sm text-on-surface-variant"
          >
            <Checkbox
              id="usesInclusiveTax"
              checked={usesInclusiveTax}
              onCheckedChange={(v) => setUsesInclusiveTax(v === true)}
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
          currencyCode={currencyCode}
        />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-label text-on-surface/60 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
          />
        </div>
        <div>
          <label className="block text-sm font-label text-on-surface/60 mb-1">
            Terms
          </label>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
          />
        </div>
      </div>

      <RequiredFieldsHint />
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? t("saving") : t("saveAsDraft")}
        </Button>
      </div>
    </div>
  );
}
