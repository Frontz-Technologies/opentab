"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { detectCountryFromTaxId } from "@/lib/utils";
import { updateCompanySettings } from "./actions";

const CURRENCIES = [
  { code: "EUR", label: "Euro (€)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EU_COUNTRIES = [
  { code: "GR", name: "Greece" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
];

const inputClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:bg-surface-container-high transition-colors";

const selectClass =
  "w-full bg-surface-container-lowest border-none rounded-xl px-4 h-12 text-sm text-on-surface focus:outline-none focus:bg-surface-container-high transition-colors appearance-none cursor-pointer";

interface FieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, children, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block font-medium text-sm text-on-surface">{label}</label>
      {children}
      {hint && <p className="text-xs text-on-surface-variant/70">{hint}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-headline text-lg font-bold text-on-surface mb-4">{children}</h3>;
}

export interface CompanyFormData {
  name: string;
  defaultCurrency: string;
  fiscalYearStart: number;
  taxId: string;
  taxAuthority: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  region: string;
  phone: string;
}

interface CompanyFormProps {
  initialData: CompanyFormData;
}

export function CompanyForm({ initialData }: CompanyFormProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [detectedCountry, setDetectedCountry] = useState<string | null>(
    initialData.country || null,
  );
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function handleTaxIdBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.target.value;
    const country = detectCountryFromTaxId(value);
    setDetectedCountry(country);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateCompanySettings(formData);
        setToast({ type: "success", message: t("saved") });
      } catch {
        setToast({ type: "error", message: "Failed to save settings. Please try again." });
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
        {/* Company Info */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("companyInfo")}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={t("companyName")}>
              <input
                type="text"
                name="name"
                className={inputClass}
                placeholder="Acme Ltd."
                defaultValue={initialData.name}
                required
              />
            </Field>
            <Field label={t("defaultCurrency")}>
              <div className="relative">
                <select name="defaultCurrency" className={selectClass} defaultValue={initialData.defaultCurrency}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
            <Field label={t("fiscalYearStart")}>
              <div className="relative">
                <select name="fiscalYearStart" className={selectClass} defaultValue={String(initialData.fiscalYearStart)}>
                  {MONTHS.map((month, index) => (
                    <option key={index + 1} value={index + 1}>{month}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
          </div>
        </section>

        {/* Tax Info */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("taxInfo")}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field
              label={t("taxId")}
              hint={detectedCountry ? `Detected country: ${EU_COUNTRIES.find(c => c.code === detectedCountry)?.name ?? detectedCountry}` : "Enter your VAT number (e.g. EL123456789 or 123456789)"}
            >
              <input
                type="text"
                name="taxId"
                className={inputClass}
                placeholder="EL123456789"
                defaultValue={initialData.taxId}
                onBlur={handleTaxIdBlur}
              />
            </Field>
            <Field label={t("taxAuthority")}>
              <input
                type="text"
                name="taxAuthority"
                className={inputClass}
                placeholder="e.g. AADE"
                defaultValue={initialData.taxAuthority}
              />
            </Field>
          </div>
        </section>

        {/* Address */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("address")}</SectionHeading>
          <div className="grid grid-cols-1 gap-5">
            <Field label={t("country")}>
              <div className="relative">
                <select
                  name="country"
                  className={selectClass}
                  value={detectedCountry ?? ""}
                  onChange={(e) => setDetectedCountry(e.target.value || null)}
                >
                  <option value="">Select country…</option>
                  {EU_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
            <Field label={t("addressLine1")}>
              <input
                type="text"
                name="addressLine1"
                className={inputClass}
                placeholder="123 Main Street"
                defaultValue={initialData.addressLine1}
              />
            </Field>
            <Field label={t("addressLine2")}>
              <input
                type="text"
                name="addressLine2"
                className={inputClass}
                placeholder="Suite 100 (optional)"
                defaultValue={initialData.addressLine2}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label={t("city")}>
                <input type="text" name="city" className={inputClass} placeholder="Athens" defaultValue={initialData.city} />
              </Field>
              <Field label={t("postalCode")}>
                <input type="text" name="postalCode" className={inputClass} placeholder="10431" defaultValue={initialData.postalCode} />
              </Field>
              <Field label={t("region")}>
                <input type="text" name="region" className={inputClass} placeholder="Attica" defaultValue={initialData.region} />
              </Field>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("contact")}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={t("phone")}>
              <input
                type="tel"
                name="phone"
                className={inputClass}
                placeholder="+30 210 0000000"
                defaultValue={initialData.phone}
              />
            </Field>
          </div>
        </section>

        {/* Branding */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
          <SectionHeading>{t("branding")}</SectionHeading>
          <div className="flex flex-col items-center justify-center min-h-[120px] rounded-xl border-2 border-dashed border-outline-variant/30 text-on-surface/30 gap-2">
            <span className="material-symbols-outlined text-3xl">image</span>
            <p className="text-sm font-medium">{t("logoPlaceholder")}</p>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : tCommon("save")}
          </button>
        </div>
      </form>
    </>
  );
}
