"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Contact, ExpenseCategory } from "@opentab/db/schema";
import { EXPENSE_FREQUENCY } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createRecurringExpense } from "./actions";

interface LineItem {
  sortOrder: number;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  taxCategory: string;
  taxRate: string;
  categoryId: string;
}

interface RecurringExpenseFormProps {
  contacts: Contact[];
  categories: ExpenseCategory[];
  defaultCurrency: string;
  defaultTaxRate: string;
}

const frequencyOptions = [
  { value: EXPENSE_FREQUENCY.DAILY, key: "frequencyDaily" },
  { value: EXPENSE_FREQUENCY.WEEKLY, key: "frequencyWeekly" },
  { value: EXPENSE_FREQUENCY.BIWEEKLY, key: "frequencyBiweekly" },
  { value: EXPENSE_FREQUENCY.MONTHLY, key: "frequencyMonthly" },
  { value: EXPENSE_FREQUENCY.QUARTERLY, key: "frequencyQuarterly" },
  { value: EXPENSE_FREQUENCY.BIANNUALLY, key: "frequencyBiannually" },
  { value: EXPENSE_FREQUENCY.ANNUALLY, key: "frequencyAnnually" },
] as const;

export function RecurringExpenseForm({
  contacts,
  categories,
  defaultCurrency,
  defaultTaxRate,
}: RecurringExpenseFormProps) {
  const t = useTranslations("recurringExpenses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState(String(EXPENSE_FREQUENCY.MONTHLY));
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState("");
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    {
      sortOrder: 0,
      name: "",
      description: "",
      quantity: "1",
      unitPrice: "0.00",
      unit: "",
      taxCategory: "standard",
      taxRate: defaultTaxRate,
      categoryId: "",
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  function addItem() {
    setItems([
      ...items,
      {
        sortOrder: items.length,
        name: "",
        description: "",
        quantity: "1",
        unitPrice: "0.00",
        unit: "",
        taxCategory: "standard",
        taxRate: defaultTaxRate,
        categoryId: "",
      },
    ]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  function handleSubmit() {
    if (items.length === 0 || items.every((i) => !i.name)) {
      setError("At least one line item is required");
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("categoryId", categoryId);
    formData.set("frequency", frequency);
    formData.set("startDate", startDate);
    formData.set("endDate", endDate);
    formData.set("autoConfirm", String(autoConfirm));
    formData.set("currencyCode", currencyCode);
    formData.set("usesInclusiveTax", "false");
    formData.set("description", description);
    formData.set("notes", notes);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result = await createRecurringExpense(formData);
      if (result.success) {
        router.push("/recurring-expenses");
      } else {
        setError("Validation failed");
      }
    });
  }

  const rootCategories = categories.filter((c) => c.depth === 0);

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="font-label text-sm text-on-surface/60">
              {t("supplier")}
            </label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-surface-container-low border border-on-surface/10 text-on-surface text-sm"
            >
              <option value="">{t("selectSupplier")}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="font-label text-sm text-on-surface/60">
              {t("frequency")}
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-surface-container-low border border-on-surface/10 text-on-surface text-sm"
            >
              {frequencyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.key)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="font-label text-sm text-on-surface/60">
              {t("startDate")}
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="font-label text-sm text-on-surface/60">
              {t("endDate")}
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <p className="text-xs text-on-surface/40">{t("endDateHelp")}</p>
          </div>
          <div className="space-y-2">
            <label className="font-label text-sm text-on-surface/60">
              {t("currency")}
            </label>
            <Input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              maxLength={3}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="font-label text-sm text-on-surface/60">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-surface-container-low border border-on-surface/10 text-on-surface text-sm"
            >
              <option value="">--</option>
              {rootCategories.map((cat) => (
                <optgroup key={cat.id} label={cat.nameEn}>
                  <option value={cat.id}>{cat.nameEn}</option>
                  {categories
                    .filter((c) => c.parentId === cat.id)
                    .map((child) => (
                      <option key={child.id} value={child.id}>
                        &nbsp;&nbsp;{child.nameEn}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="accent-primary"
              />
              <span className="text-sm text-on-surface/60">
                {t("autoConfirm")}
              </span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-label text-sm text-on-surface/60">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-6">
        <h3 className="font-headline text-lg font-semibold text-on-surface mb-4">
          Line Items
        </h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-on-surface/10">
              <th className="text-left px-2 py-2 font-label text-sm text-on-surface/60">
                Item
              </th>
              <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60 w-20">
                Qty
              </th>
              <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60 w-28">
                Unit price
              </th>
              <th className="text-right px-2 py-2 font-label text-sm text-on-surface/60 w-20">
                Tax %
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-on-surface/5">
                <td className="px-2 py-2">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    placeholder="Item name"
                    className="h-8 text-sm"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, "quantity", e.target.value)
                    }
                    className="h-8 text-sm text-right"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(index, "unitPrice", e.target.value)
                    }
                    className="h-8 text-sm text-right"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={item.taxRate}
                    onChange={(e) =>
                      updateItem(index, "taxRate", e.target.value)
                    }
                    className="h-8 text-sm text-right"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-on-surface/30 hover:text-red-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        close
                      </span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="mt-3"
        >
          <span className="material-symbols-outlined text-[16px] mr-1">
            add
          </span>
          Add item
        </Button>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/recurring-expenses")}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "..." : t("save")}
        </Button>
      </div>
    </div>
  );
}
