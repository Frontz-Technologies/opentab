"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Contact, Product } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      const result = await createQuote(formData);
      if (result.success) {
        router.push("/quotes");
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
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("validUntil")}
            </label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              Currency
            </label>
            <Input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              maxLength={3}
            />
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

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? t("saving") : t("saveAsDraft")}
        </Button>
      </div>
    </div>
  );
}
