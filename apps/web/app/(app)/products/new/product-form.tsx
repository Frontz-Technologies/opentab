"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Product } from "@opentab/db/schema";
import type { VatRate } from "@/lib/country";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProduct, updateProduct } from "../actions";

const inputClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:bg-surface-container-high transition-colors";

interface FieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}

function Field({ label, children, hint, required }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block font-medium text-sm text-on-surface">
        {label}
        {required && <span className="text-tertiary ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-on-surface-variant/70">{hint}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-headline text-lg font-bold text-on-surface mb-4">
      {children}
    </h3>
  );
}

interface ProductFormProps {
  product?: Product;
  vatRates: VatRate[];
}

export function ProductForm({ product, vatRates }: ProductFormProps) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [unit, setUnit] = useState<string>(product?.unit ?? "item");
  const [taxCategory, setTaxCategory] = useState<string>(
    product?.taxCategory ?? "standard",
  );
  const [vatRate, setVatRate] = useState<string>(product?.vatRate ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Ensure active is set
    if (!formData.has("active")) {
      formData.set("active", "false");
    }
    startTransition(async () => {
      try {
        const result = product
          ? await updateProduct(product.id, formData)
          : await createProduct(formData);
        if (result.success) {
          setToast({ type: "success", message: t("saved") });
          if (!product) {
            router.push("/products");
          }
        } else {
          const errorMsg =
            result.error && typeof result.error === "object"
              ? Object.values(result.error).flat().join(", ")
              : "Validation failed";
          setToast({ type: "error", message: errorMsg });
        }
      } catch {
        setToast({ type: "error", message: "Failed to save product" });
      }
      setTimeout(() => setToast(null), 4000);
    });
  }

  return (
    <>
      {toast && (
        <div
          className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
            toast.type === "success"
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Product Info */}
        <section className="bg-surface-container rounded-2xl p-6 space-y-5">
          <SectionHeading>{t("name")}</SectionHeading>
          <div className="grid grid-cols-1 gap-5">
            <Field label={t("name")} required>
              <input
                type="text"
                name="name"
                className={inputClass}
                placeholder="Web Development"
                defaultValue={product?.name ?? ""}
                required
              />
            </Field>
            <Field label={t("description")}>
              <textarea
                name="description"
                className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:bg-surface-container-high transition-colors min-h-[80px] resize-y"
                placeholder="Optional description"
                defaultValue={product?.description ?? ""}
              />
            </Field>
          </div>
        </section>

        {/* Pricing */}
        <section className="bg-surface-container rounded-2xl p-6 space-y-5">
          <SectionHeading>{t("unitPrice")}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={t("unitPrice")} required>
              <input
                type="number"
                name="unitPrice"
                className={inputClass}
                placeholder="100.00"
                step="0.01"
                min="0"
                defaultValue={product?.unitPrice ?? ""}
                required
              />
            </Field>
            <Field label={t("unit")}>
              <Select value={unit} onValueChange={(v) => setUnit(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="item">{t("unitItem")}</SelectItem>
                  <SelectItem value="hour">{t("unitHour")}</SelectItem>
                  <SelectItem value="day">{t("unitDay")}</SelectItem>
                  <SelectItem value="service">{t("unitService")}</SelectItem>
                  <SelectItem value="kg">{t("unitKg")}</SelectItem>
                  <SelectItem value="unit">{t("unitUnit")}</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="unit" value={unit} />
            </Field>
          </div>
        </section>

        {/* Tax */}
        <section className="bg-surface-container rounded-2xl p-6 space-y-5">
          <SectionHeading>{t("taxCategory")}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={t("taxCategory")}>
              <Select
                value={taxCategory}
                onValueChange={(v) => setTaxCategory(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">{t("taxStandard")}</SelectItem>
                  <SelectItem value="reduced">{t("taxReduced")}</SelectItem>
                  <SelectItem value="super_reduced">
                    {t("taxSuperReduced")}
                  </SelectItem>
                  <SelectItem value="zero_rated">
                    {t("taxZeroRated")}
                  </SelectItem>
                  <SelectItem value="exempt">{t("taxExempt")}</SelectItem>
                  <SelectItem value="reverse_charge">
                    {t("taxReverseCharge")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="taxCategory" value={taxCategory} />
            </Field>
            <Field label={t("vatRate")} hint={t("vatRateHelp")}>
              <Select
                value={vatRate || undefined}
                onValueChange={(v) => setVatRate(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {vatRates.map((vr) => (
                    <SelectItem key={vr.rate} value={vr.rate}>
                      {vr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="vatRate" value={vatRate} />
            </Field>
          </div>
        </section>

        {/* Status */}
        <section className="bg-surface-container rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="active"
              value="true"
              defaultChecked={product?.active ?? true}
              className="rounded"
              id="active-toggle"
            />
            <label
              htmlFor="active-toggle"
              className="font-medium text-sm text-on-surface cursor-pointer"
            >
              {t("active")}
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending
              ? "Saving..."
              : product
                ? tCommon("save")
                : t("addProduct")}
          </button>
        </div>
      </form>
    </>
  );
}
