"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Invoice } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CREDIT_NOTE_REASON } from "@opentab/db/schema";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState<string>(
    prefilledInvoice?.contactId ?? contacts[0]?.id ?? "",
  );
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState<string>(CREDIT_NOTE_REASON.RETURN);
  const [reasonNote, setReasonNote] = useState("");
  const [items, setItems] = useState<LineItem[]>([newLine(0)]);

  const selectedContact = contacts.find((c) => c.id === contactId);

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
    formData.set("currencyCode", defaultCurrency);
    formData.set("usesInclusiveTax", "false");
    formData.set("contactName", selectedContact.displayName);
    formData.set("contactEmail", selectedContact.email ?? "");
    formData.set("contactVatNumber", selectedContact.vatNumber ?? "");
    formData.set("reason", reason);
    formData.set("reasonNote", reasonNote);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result = await createCreditNote(formData);
      if (result.success && result.creditNote) {
        toast.success(t("created"));
        router.push(`/credit-notes/${result.creditNote.id}`);
      } else {
        toast.error(t("validationFailed"));
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
          <label className="block text-sm font-label text-on-surface mb-1">
            {t("client")}
          </label>
          <select
            className="bg-surface-container-lowest text-on-surface rounded-lg px-3 h-10 w-full"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            required
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-label text-on-surface mb-1">
            {t("issueDate")}
          </label>
          <Input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-label text-on-surface mb-1">
          {t("reason")}
        </label>
        <select
          className="bg-surface-container-lowest text-on-surface rounded-lg px-3 h-10 w-full"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <option value={CREDIT_NOTE_REASON.RETURN}>{t("reasonReturn")}</option>
          <option value={CREDIT_NOTE_REASON.CORRECTION}>
            {t("reasonCorrection")}
          </option>
          <option value={CREDIT_NOTE_REASON.DISCOUNT}>
            {t("reasonDiscount")}
          </option>
          <option value={CREDIT_NOTE_REASON.OTHER}>{t("reasonOther")}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-label text-on-surface mb-1">
          {t("reasonNote")}
        </label>
        <Input
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
              placeholder={t("itemName")}
              value={item.name}
              onChange={(e) => updateItem(idx, { name: e.target.value })}
              required
            />
            <Input
              type="number"
              step="0.01"
              value={item.quantity}
              onChange={(e) => updateItem(idx, { quantity: e.target.value })}
            />
            <Input
              type="number"
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
            />
            <Input
              type="number"
              step="0.01"
              value={item.taxRate}
              onChange={(e) => updateItem(idx, { taxRate: e.target.value })}
            />
            {items.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeItem(idx)}
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
