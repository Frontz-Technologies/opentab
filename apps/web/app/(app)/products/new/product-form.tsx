"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Product } from "@opentab/db/schema";
import type { VatRate } from "@/lib/country";
import { createProduct, updateProduct } from "../actions";

const inputClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:bg-surface-container-high transition-colors";

const selectClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface focus:outline-none focus:bg-surface-container-high transition-colors appearance-none cursor-pointer";

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
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
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
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
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
              <div className="relative">
                <select
                  name="unit"
                  className={selectClass}
                  defaultValue={product?.unit ?? "item"}
                >
                  <option value="item">{t("unitItem")}</option>
                  <option value="hour">{t("unitHour")}</option>
                  <option value="day">{t("unitDay")}</option>
                  <option value="service">{t("unitService")}</option>
                  <option value="kg">{t("unitKg")}</option>
                  <option value="unit">{t("unitUnit")}</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
          </div>
        </section>

        {/* Tax */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("taxCategory")}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={t("taxCategory")}>
              <div className="relative">
                <select
                  name="taxCategory"
                  className={selectClass}
                  defaultValue={product?.taxCategory ?? "standard"}
                >
                  <option value="standard">{t("taxStandard")}</option>
                  <option value="reduced">{t("taxReduced")}</option>
                  <option value="super_reduced">{t("taxSuperReduced")}</option>
                  <option value="zero_rated">{t("taxZeroRated")}</option>
                  <option value="exempt">{t("taxExempt")}</option>
                  <option value="reverse_charge">
                    {t("taxReverseCharge")}
                  </option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
            <Field label={t("vatRate")} hint={t("vatRateHelp")}>
              <div className="relative">
                <select
                  name="vatRate"
                  className={selectClass}
                  defaultValue={product?.vatRate ?? ""}
                >
                  <option value="">---</option>
                  {vatRates.map((vr) => (
                    <option key={vr.rate} value={vr.rate}>
                      {vr.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
          </div>
        </section>

        {/* Status */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
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
            {isPending ? "Saving..." : tCommon("save")}
          </button>
        </div>
      </form>
    </>
  );
}
