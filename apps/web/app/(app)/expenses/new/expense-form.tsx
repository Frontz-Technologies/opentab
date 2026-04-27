"use client";

import { useRef, useState, useTransition } from "react";
import { UnsavedChangesGuard } from "@/components/forms/unsaved-changes-guard";
import { EmptyEntityHint } from "@/components/forms/empty-entity-hint";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type {
  Contact,
  ExpenseCategory,
  ExpenseGroup,
} from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineItemsBuilder,
  type LineItem,
} from "@/components/invoicing/line-items-builder";
import { buildAutofilledLineItems } from "@/lib/expenses/autofill-line-items";
import { GROUP_TYPE_MARKER } from "@/lib/expenses/group-type";
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
  const locale = useLocale();
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
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tCommon = useTranslations("common");

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

  // Group names are stored per-locale on the expense_group table
  // (nameEn notNull, nameEl/nameEs/nameDe nullable). Use the active
  // locale's field, fall back to nameEn. Previously the optgroup
  // label was hardcoded to nameEn which produced an English-over-
  // localized duplication on the Greek/Spanish sessions.
  function groupNameForLocale(g: ExpenseGroup): string {
    if (locale === "el" && g.nameEl) return g.nameEl;
    if (locale === "es" && g.nameEs) return g.nameEs;
    if (locale === "de" && g.nameDe) return g.nameDe;
    return g.nameEn;
  }

  // Auto-default the first line item's name from the selected category
  // when the user hasn't typed anything custom. Reduces the visible
  // "Category: Rent / Item: <blank>" redundancy on the simple single-
  // line case — user can still override. Only touches the FIRST item;
  // multi-line expenses where distinct names matter are unaffected.
  // Kept as an event-driven handler (not useEffect) per React's
  // set-state-in-effect lint rule — this belongs in the onChange path.
  function handleCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId);
    if (!newCategoryId) return;
    const cat = categories.find((c) => c.id === newCategoryId);
    if (!cat) return;
    setItems((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      if (first.name.trim()) return prev;
      return [{ ...first, name: cat.name }, ...rest];
    });
  }

  async function handleClearAll() {
    if (uploadedFile) {
      await cleanupTempAttachment(uploadedFile.filePath);
    }
    setContactId("");
    setSupplierName("");
    setCategoryId("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setPaymentDate("");
    setCurrencyCode(defaultCurrency);
    setUsesInclusiveTax(false);
    setSupplierInvoiceNumber("");
    setDescription("");
    setNotes("");
    setItems([]);
    setError(null);
    setUploadedFile(null);
    setExtractResult(null);
    setShowAutofillPrompt(false);
    setShowNoDataNotice(false);
    setClearDialogOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
      <UnsavedChangesGuard isDirty={isDirty} />
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
              {isUploading
                ? t("processingReceiptHint")
                : t("uploadReceiptHint")}
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
        <div
          role="alert"
          className="bg-error/10 text-error rounded-lg p-3 text-sm"
        >
          {error}
        </div>
      )}

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          {t("supplier")}
        </h2>
        <Select
          value={contactId || undefined}
          onValueChange={(v) => {
            const next = v;
            setContactId(next);
            if (next) setSupplierName("");
            const contact = contacts.find((c) => c.id === next);
            if (contact?.defaultCurrency)
              setCurrencyCode(contact.defaultCurrency);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("selectSupplier")} />
          </SelectTrigger>
          <SelectContent>
            {contacts
              .filter((c) => c.type === "supplier" || c.type === "both")
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
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
            {categories.length === 0 ? (
              <EmptyEntityHint
                message={t("noCategoriesYet")}
                ctaLabel={t("manageCategories")}
                ctaHref="/expenses/categories"
              />
            ) : (
              <Select
                value={categoryId || undefined}
                onValueChange={(v) => handleCategoryChange(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {groupedCategories
                    .filter((g) => g.items.length > 0)
                    .map((g) => (
                      <SelectGroup key={g.group.code}>
                        <SelectLabel>
                          {`${GROUP_TYPE_MARKER[g.group.type]} ${groupNameForLocale(g.group)}`}
                        </SelectLabel>
                        {g.items.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                </SelectContent>
              </Select>
            )}
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

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          type="button"
          disabled={isPending || !isDirty}
          onClick={() => setClearDialogOpen(true)}
        >
          {t("clearAll")}
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
      </div>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clearAllTitle")}</DialogTitle>
            <DialogDescription>{t("clearAllDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setClearDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClearAll}
            >
              {tCommon("discard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
