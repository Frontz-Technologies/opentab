"use client";

import { useRef, useState, useTransition } from "react";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
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
import { buildAutofilledLineItems } from "@/lib/expenses/autofill-line-items";
import {
  createExpense,
  uploadAndExtractReceipt,
  cleanupTempAttachment,
  type UploadedFileInfo,
  type UploadReceiptResult,
} from "../actions";

interface ExpenseFormProps {
  contacts: Contact[];
  groups: ExpenseGroup[];
  categories: ExpenseCategory[];
  defaultCurrency: string;
  defaultTaxRate: string;
  aiExtractionAvailable?: boolean;
}

export function ExpenseForm({
  contacts,
  groups,
  categories,
  defaultCurrency,
  defaultTaxRate,
  aiExtractionAvailable = false,
}: ExpenseFormProps) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [supplierName, setSupplierName] = useState("");
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
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(
    null,
  );
  const [extractResult, setExtractResult] =
    useState<UploadReceiptResult | null>(null);
  const [showAutofillPrompt, setShowAutofillPrompt] = useState(false);
  const [showNoDataNotice, setShowNoDataNotice] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedContact = contacts.find((c) => c.id === contactId);

  // Track whether the form has unsaved data
  const isDirty =
    !!uploadedFile ||
    !!contactId ||
    !!supplierName ||
    !!categoryId ||
    !!description ||
    !!notes ||
    !!supplierInvoiceNumber ||
    items.length > 0;

  useUnsavedChangesWarning(isDirty, t("discardConfirm"));

  const submittedRef = useRef(false);

  function applyAutofill(result: UploadReceiptResult) {
    const data = result.extractedData;
    if (!data) return;

    if (result.supplierMatch) {
      setContactId(result.supplierMatch.contactId);
    }
    if (data.vendorName && !contactId) {
      setSupplierName(data.vendorName);
    }
    if (data.date) {
      setExpenseDate(data.date);
    }
    if (data.currency && currencyCode === defaultCurrency) {
      setCurrencyCode(data.currency);
    }
    if (data.description && !description) {
      setDescription(data.description);
    }
    if (data.categoryId && !categoryId) {
      setCategoryId(data.categoryId);
    }

    if (items.length === 0 && (data.lineItems.length > 0 || data.totalAmount)) {
      setItems(
        buildAutofilledLineItems({
          lineItems: data.lineItems,
          totalAmount: data.totalAmount,
          description: data.description,
          defaultTaxRate,
          usesInclusiveTax,
        }),
      );
    }

    setShowAutofillPrompt(false);
  }

  async function handleReceiptUpload(file: File) {
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadAndExtractReceipt(formData);
      if (!result.success) {
        setError(result.error ?? "Upload failed");
        setIsUploading(false);
        return;
      }
      setUploadedFile(result.fileInfo ?? null);
      setExtractResult(result);
      setShowAutofillPrompt(false);
      setShowNoDataNotice(false);

      const hasData =
        result.extractedData &&
        (result.extractedData.vendorName ||
          result.extractedData.totalAmount ||
          result.extractedData.date ||
          result.extractedData.categoryId ||
          result.extractedData.lineItems.length > 0);

      if (hasData) {
        const pref = localStorage.getItem("receiptAutofillPreference");
        if (pref === "always") {
          applyAutofill(result);
        } else {
          setShowAutofillPrompt(true);
        }
      } else {
        setShowNoDataNotice(true);
      }
    } catch {
      setError("Failed to upload receipt");
    }
    setIsUploading(false);
  }

  async function handleRemoveAttachment() {
    if (uploadedFile) {
      await cleanupTempAttachment(uploadedFile.filePath);
      setUploadedFile(null);
      setExtractResult(null);
      setShowAutofillPrompt(false);
      setShowNoDataNotice(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
    formData.set(
      "contactName",
      selectedContact?.displayName ?? supplierName ?? "",
    );
    formData.set("contactVatNumber", selectedContact?.vatNumber ?? "");
    formData.set("description", description);
    formData.set("notes", notes);
    formData.set("items", JSON.stringify(items));
    if (uploadedFile) {
      formData.set("attachment", JSON.stringify(uploadedFile));
    }

    startTransition(async () => {
      const result = await createExpense(formData);
      if (result.success) {
        submittedRef.current = true;
        router.push("/expenses");
      } else {
        setError(JSON.stringify(result.error));
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-surface-container rounded-xl p-6">
        {!uploadedFile ? (
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleReceiptUpload(file);
              }}
            />
            <Button
              variant="outline"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <span className="material-symbols-outlined text-[18px] mr-1">
                {isUploading ? "hourglass_empty" : "upload_file"}
              </span>
              {isUploading
                ? aiExtractionAvailable
                  ? t("analyzingReceipt")
                  : t("uploading")
                : t("uploadReceipt")}
            </Button>
            <span className="text-sm text-on-surface/50">
              {t("uploadReceiptHint")}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  attach_file
                </span>
                <span className="text-sm text-on-surface font-medium">
                  {uploadedFile.fileName}
                </span>
                <span className="text-xs text-on-surface/50">
                  ({Math.round(uploadedFile.fileSize / 1024)} KB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleRemoveAttachment}
              >
                <span className="material-symbols-outlined text-[16px]">
                  close
                </span>
                {t("removeAttachment")}
              </Button>
            </div>

            {showNoDataNotice && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-lg bg-surface-container-high px-4 py-3"
              >
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-on-surface-variant text-[20px]"
                >
                  info
                </span>
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-on-surface font-medium">
                    {t("receiptNoDataTitle")}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {t("receiptNoDataBody")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  aria-label={t("dismiss")}
                  onClick={() => setShowNoDataNotice(false)}
                >
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-[16px]"
                  >
                    close
                  </span>
                </Button>
              </div>
            )}

            {showAutofillPrompt && (
              <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  auto_fix_high
                </span>
                <span className="text-sm text-on-surface flex-1">
                  {t("autofillPrompt")}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => {
                      if (extractResult) applyAutofill(extractResult);
                    }}
                  >
                    {t("autofillApply")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setShowAutofillPrompt(false)}
                  >
                    {t("autofillIgnore")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      localStorage.setItem(
                        "receiptAutofillPreference",
                        "always",
                      );
                      if (extractResult) applyAutofill(extractResult);
                    }}
                  >
                    {t("autofillAlways")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
            if (e.target.value) setSupplierName("");
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
        {!contactId && (
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("supplierNameFreeText")}
            </label>
            <Input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder={t("supplierNamePlaceholder")}
            />
          </div>
        )}
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
              {t("expenseDate")} <span className="text-tertiary">*</span>
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
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-headline text-lg font-semibold text-on-surface">
            {t("lineItems")} <span className="text-tertiary">*</span>
          </h2>
          {items.length === 0 && (
            <p className="text-sm text-on-surface/50">{t("itemRequired")}</p>
          )}
        </div>
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
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
