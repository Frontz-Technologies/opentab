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
import { createExpense } from "../actions";

interface ExpenseFormProps {
  contacts: Contact[];
  groups: ExpenseGroup[];
  categories: ExpenseCategory[];
  defaultCurrency: string;
  defaultTaxRate: string;
}

export function ExpenseForm({
  contacts,
  groups,
  categories,
  defaultCurrency,
  defaultTaxRate,
}: ExpenseFormProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [paymentDate, setPaymentDate] = useState("");
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [usesInclusiveTax, setUsesInclusiveTax] = useState(false);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedContact = contacts.find((c) => c.id === contactId);

  // Group categories by expense group for optgroup display
  const groupedCategories = groups.map((group) => ({
    group,
    items: categories.filter((c) => c.groupCode === group.code),
  }));

  function handleSubmit() {
    if (items.length === 0) {
      setError(t("itemRequired"));
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("categoryId", categoryId);
    formData.set("expenseDate", expenseDate);
    formData.set("paymentDate", paymentDate);
    formData.set("currencyCode", currencyCode);
    formData.set("usesInclusiveTax", String(usesInclusiveTax));
    formData.set("supplierInvoiceNumber", supplierInvoiceNumber);
    formData.set("contactName", selectedContact?.displayName ?? "");
    formData.set("contactVatNumber", selectedContact?.vatNumber ?? "");
    formData.set("description", description);
    formData.set("notes", notes);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result = await createExpense(formData);
      if (result.success) {
        router.push("/expenses");
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
          {t("supplier")}
        </h2>
        <select
          value={contactId}
          onChange={(e) => {
            setContactId(e.target.value);
            const contact = contacts.find((c) => c.id === e.target.value);
            if (contact?.defaultCurrency)
              setCurrencyCode(contact.defaultCurrency);
          }}
          className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
        >
          <option value="">{t("selectSupplier")}</option>
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
          {t("details")}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("category")}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
            >
              <option value="">{t("selectCategory")}</option>
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
              {t("supplierInvoiceNumber")}
            </label>
            <Input
              value={supplierInvoiceNumber}
              onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("expenseDate")}
            </label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("paymentDate")}
            </label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("currency")}
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
                checked={usesInclusiveTax}
                onChange={(e) => setUsesInclusiveTax(e.target.checked)}
                className="rounded"
              />
              {t("inclusiveTax")}
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
            {t("description")}
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
            {t("notes")}
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
          {isPending ? t("saving") : t("saveAsDraft")}
        </Button>
      </div>
    </div>
  );
}
