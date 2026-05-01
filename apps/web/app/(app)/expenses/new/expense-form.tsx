"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { UnsavedChangesGuard } from "@/components/forms/unsaved-changes-guard";
import { EmptyEntityHint } from "@/components/forms/empty-entity-hint";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Hourglass, Upload, Paperclip, X, Info, Sparkles } from "lucide-react";
import type {
  Contact,
  ExpenseCategory,
  ExpenseGroup,
} from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { CategoryCombobox } from "./category-combobox";
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
import type { ExpenseSeed } from "@/lib/expenses/seed-from-source";
import { GROUP_TYPE_MARKER } from "@/lib/expenses/group-type";
import {
  acceptExtractionPreview,
  discardPreview,
  exitFieldPreview,
  exitItemPreview,
  type PreviewableFieldName,
  type Snapshot,
} from "@/lib/expenses/extraction-preview-state";
import {
  createExpense,
  uploadAndExtractReceipt,
  cleanupTempAttachment,
  type UploadedFileInfo,
  type UploadReceiptResult,
} from "../actions";

type UploadReceiptSuccess = Extract<UploadReceiptResult, { success: true }>;

interface ExpenseFormProps {
  contacts: Contact[];
  groups: ExpenseGroup[];
  categories: ExpenseCategory[];
  defaultCurrency: string;
  defaultTaxRate: string;
  aiExtractionAvailable?: boolean;
  seed?: ExpenseSeed | null;
}

export function ExpenseForm({
  contacts,
  groups,
  categories,
  defaultCurrency,
  defaultTaxRate,
  aiExtractionAvailable = false,
  seed = null,
}: ExpenseFormProps) {
  const t = useTranslations("expenses");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState(seed?.contactId ?? "");
  const [supplierName, setSupplierName] = useState(seed?.contactName ?? "");
  const [categoryId, setCategoryId] = useState(seed?.categoryId ?? "");
  // expenseDate intentionally NOT seeded — always defaults to today.
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [paymentDate, setPaymentDate] = useState("");
  const [currencyCode, setCurrencyCode] = useState(
    seed?.currencyCode ?? defaultCurrency,
  );
  const [usesInclusiveTax, setUsesInclusiveTax] = useState(
    seed?.usesInclusiveTax ?? false,
  );
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [description, setDescription] = useState(seed?.description ?? "");
  const [notes, setNotes] = useState(seed?.notes ?? "");
  const [items, setItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(
    null,
  );
  const [extractResult, setExtractResult] =
    useState<UploadReceiptSuccess | null>(null);
  const [showAutofillPrompt, setShowAutofillPrompt] = useState(false);
  const [showNoDataNotice, setShowNoDataNotice] = useState(false);
  const [previewFields, setPreviewFields] = useState<Set<PreviewableFieldName>>(
    new Set(),
  );
  const [previewLineItems, setPreviewLineItems] = useState<Set<string>>(
    new Set(),
  );
  const [preExtractionSnapshot, setPreExtractionSnapshot] = useState<Snapshot>(
    {},
  );
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

  const [rateInfo, setRateInfo] = useState<{
    rate: number;
    effectiveDate: string;
    staleFallback: boolean;
  } | null>(null);

  useEffect(() => {
    if (currencyCode === defaultCurrency || !expenseDate) {
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/fx/preview?date=${encodeURIComponent(expenseDate)}&from=${encodeURIComponent(currencyCode)}&to=${encodeURIComponent(defaultCurrency)}`,
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
  }, [currencyCode, expenseDate, defaultCurrency]);

  function applyAutofill(result: UploadReceiptSuccess) {
    const data = result.extractedData;
    if (!data) return;

    const builtItems =
      items.length === 0 && (data.lineItems.length > 0 || data.totalAmount)
        ? buildAutofilledLineItems({
            lineItems: data.lineItems,
            totalAmount: data.totalAmount,
            description: data.description,
            defaultTaxRate,
            usesInclusiveTax,
          })
        : [];

    const accepted = acceptExtractionPreview({
      state: {
        contactId,
        supplierName,
        expenseDate,
        currencyCode,
        description,
        categoryId,
        items,
      },
      defaultCurrency,
      defaultTaxRate,
      usesInclusiveTax,
      supplierMatch: result.supplierMatch ?? null,
      data,
      builtItems,
    });

    setContactId(accepted.nextState.contactId);
    setSupplierName(accepted.nextState.supplierName);
    setExpenseDate(accepted.nextState.expenseDate);
    setCurrencyCode(accepted.nextState.currencyCode);
    setDescription(accepted.nextState.description);
    setCategoryId(accepted.nextState.categoryId);
    setItems(accepted.nextState.items);

    setPreviewFields(accepted.previewFields);
    setPreviewLineItems(accepted.previewLineItems);
    setPreExtractionSnapshot(accepted.snapshot);
  }

  function handleApplyPanel() {
    setPreviewFields(new Set());
    setPreviewLineItems(new Set());
    setPreExtractionSnapshot({});
    setShowAutofillPrompt(false);
  }

  function handleDiscardPanel() {
    const result = discardPreview({
      state: {
        contactId,
        supplierName,
        expenseDate,
        currencyCode,
        description,
        categoryId,
        items,
      },
      previewFields,
      previewLineItems,
      snapshot: preExtractionSnapshot,
    });
    setContactId(result.nextState.contactId);
    setSupplierName(result.nextState.supplierName);
    setExpenseDate(result.nextState.expenseDate);
    setCurrencyCode(result.nextState.currencyCode);
    setDescription(result.nextState.description);
    setCategoryId(result.nextState.categoryId);
    setItems(result.nextState.items);
    setPreviewFields(new Set());
    setPreviewLineItems(new Set());
    setPreExtractionSnapshot({});
    setShowAutofillPrompt(false);
  }

  function handleExitFieldPreview(name: PreviewableFieldName) {
    if (!previewFields.has(name)) return;
    const result = exitFieldPreview({
      name,
      previewFields,
      snapshot: preExtractionSnapshot,
    });
    setPreviewFields(result.previewFields);
    setPreExtractionSnapshot(result.snapshot);
  }

  function handleExitItemPreview(id: string) {
    if (!previewLineItems.has(id)) return;
    const result = exitItemPreview({ id, previewLineItems });
    setPreviewLineItems(result.previewLineItems);
  }

  const previewWrapperClass =
    "rounded-lg bg-primary/10 outline outline-1 outline-primary/15 outline-offset-0 transition-colors duration-200";

  function fieldWrapperClass(name: PreviewableFieldName): string {
    return previewFields.has(name) ? previewWrapperClass : "";
  }

  async function handleReceiptUpload(file: File) {
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadAndExtractReceipt(formData);
      if (!result.success) {
        if (result.error === "duplicate" && result.duplicateExpenseId) {
          const duplicateId = result.duplicateExpenseId;
          toast.error(t("duplicateReceiptTitle"), {
            action: {
              label: t("duplicateReceiptOpen"),
              onClick: () => router.push(`/expenses/${duplicateId}`),
            },
          });
          setIsUploading(false);
          return;
        }
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
        applyAutofill(result);
        const pref = localStorage.getItem("receiptAutofillPreference");
        if (pref === "always") {
          handleApplyPanel();
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
    if (!categoryId) {
      setError(t("categoryRequired"));
      return;
    }
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
      try {
        const result = await createExpense(formData);
        if (result.success) {
          submittedRef.current = true;
          router.push("/expenses");
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
              {isUploading ? (
                <Hourglass className="h-[18px] w-[18px] mr-1" />
              ) : (
                <Upload className="h-[18px] w-[18px] mr-1" />
              )}
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
                <Paperclip className="h-[18px] w-[18px] text-primary" />
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
                <X className="h-4 w-4" />
                {t("removeAttachment")}
              </Button>
            </div>

            {showNoDataNotice && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-lg bg-surface-container-high px-4 py-3"
              >
                <Info
                  aria-hidden="true"
                  className="h-5 w-5 text-on-surface-variant"
                />
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
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            )}

            {showAutofillPrompt && (
              <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-sm text-on-surface flex-1">
                  {t("autofillPrompt")}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" type="button" onClick={handleApplyPanel}>
                    {t("autofillApply")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={handleDiscardPanel}
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
        <div className={fieldWrapperClass("contactId")}>
          <Select
            value={contactId || undefined}
            onValueChange={(v) => {
              handleExitFieldPreview("contactId");
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
        </div>
        {!contactId && (
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("supplierNameFreeText")}
            </label>
            <div className={fieldWrapperClass("supplierName")}>
              <Input
                value={supplierName}
                onChange={(e) => {
                  handleExitFieldPreview("supplierName");
                  setSupplierName(e.target.value);
                }}
                onFocus={() => handleExitFieldPreview("supplierName")}
                placeholder={t("supplierNamePlaceholder")}
              />
            </div>
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
              {t("category")} <span className="text-tertiary">*</span>
            </label>
            {categories.length === 0 ? (
              <EmptyEntityHint
                message={t("noCategoriesYet")}
                ctaLabel={t("manageCategories")}
                ctaHref="/expenses/categories"
              />
            ) : (
              <div className={fieldWrapperClass("categoryId")}>
                <CategoryCombobox
                  value={categoryId || undefined}
                  onChange={(v) => {
                    handleExitFieldPreview("categoryId");
                    handleCategoryChange(v);
                  }}
                  categories={categories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    groupCode: c.groupCode,
                  }))}
                  groupNameForLocale={(code) => {
                    const g = groups.find((gr) => gr.code === code);
                    if (!g) return code;
                    return `${GROUP_TYPE_MARKER[g.type]} ${groupNameForLocale(g)}`;
                  }}
                />
                <input
                  type="hidden"
                  name="categoryId"
                  value={categoryId ?? ""}
                />
              </div>
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
            <div className={fieldWrapperClass("expenseDate")}>
              <DatePicker
                value={expenseDate ? parseISO(expenseDate) : undefined}
                onChange={(d) => {
                  handleExitFieldPreview("expenseDate");
                  setExpenseDate(d ? format(d, "yyyy-MM-dd") : "");
                }}
                ariaLabel={t("expenseDate")}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("paymentDate")}
            </label>
            <DatePicker
              value={paymentDate ? parseISO(paymentDate) : undefined}
              onChange={(d) => setPaymentDate(d ? format(d, "yyyy-MM-dd") : "")}
              ariaLabel={t("paymentDate")}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("currency")}
            </label>
            <div className={fieldWrapperClass("currencyCode")}>
              <CurrencyCombobox
                value={currencyCode as SupportedCurrencyCode}
                onChange={(v) => {
                  handleExitFieldPreview("currencyCode");
                  setCurrencyCode(v);
                }}
                name="currencyCode"
                defaultCurrency={defaultCurrency as SupportedCurrencyCode}
              />
            </div>
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
            {t("inclusiveTax")}
          </label>
        </div>
        <LineItemsBuilder
          items={items}
          onChange={setItems}
          products={[]}
          defaultTaxRate={defaultTaxRate}
          usesInclusiveTax={usesInclusiveTax}
          previewIds={previewLineItems}
          onItemEdit={handleExitItemPreview}
          showDescription={false}
        />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-label text-on-surface/60 mb-1">
            {t("description")}
          </label>
          <div className={fieldWrapperClass("description")}>
            <textarea
              value={description}
              onChange={(e) => {
                handleExitFieldPreview("description");
                setDescription(e.target.value);
              }}
              onFocus={() => handleExitFieldPreview("description")}
              rows={3}
              className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
            />
          </div>
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
