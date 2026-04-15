"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Contact } from "@opentab/db/schema";
import type { VatRate, TaxOffice } from "@/lib/country";
import { createContact, updateContact, lookupVat } from "../actions";

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

interface ContactFormProps {
  contact?: Contact;
  capabilities: {
    companyLookup: boolean;
    taxOfficeList: boolean;
    eInvoicing: boolean;
    taxProjection: boolean;
    vatReport: boolean;
    expenseClassification: boolean;
  };
  taxOffices?: TaxOffice[];
  vatRates: VatRate[];
}

export function ContactForm({
  contact,
  capabilities,
  taxOffices,
}: ContactFormProps) {
  const t = useTranslations("contacts");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lookupPending, setLookupPending] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [vatValue, setVatValue] = useState(contact?.vatNumber ?? "");
  const [companyValue, setCompanyValue] = useState(contact?.company ?? "");
  const [addressLine1, setAddressLine1] = useState(contact?.addressLine1 ?? "");
  const [city, setCity] = useState(contact?.city ?? "");
  const [postalCode, setPostalCode] = useState(contact?.postalCode ?? "");
  const [taxOffice, setTaxOffice] = useState(contact?.taxOffice ?? "");

  async function handleLookup() {
    if (!vatValue.trim()) return;
    setLookupPending(true);
    try {
      const result = await lookupVat(vatValue);
      if (result.success && result.data) {
        if (result.data.name) setCompanyValue(result.data.name);
        if (result.data.address) setAddressLine1(result.data.address);
        if (result.data.city) setCity(result.data.city);
        if (result.data.postalCode) setPostalCode(result.data.postalCode);
        if (result.data.taxOffice) setTaxOffice(result.data.taxOffice);
        setToast({ type: "success", message: t("vatLookupSuccess") });
      } else {
        setToast({
          type: "error",
          message: result.error || t("vatLookupError"),
        });
      }
    } catch {
      setToast({ type: "error", message: t("vatLookupError") });
    }
    setLookupPending(false);
    setTimeout(() => setToast(null), 4000);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = contact
          ? await updateContact(contact.id, formData)
          : await createContact(formData);
        if (result.success) {
          setToast({ type: "success", message: t("saved") });
          if (!contact) {
            router.push("/contacts");
          }
        } else {
          const errorMsg =
            result.error && typeof result.error === "object"
              ? Object.values(result.error).flat().join(", ")
              : "Validation failed";
          setToast({ type: "error", message: errorMsg });
        }
      } catch {
        setToast({ type: "error", message: "Failed to save contact" });
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
        {/* Type & Classification */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("type")}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={t("type")} required>
              <div className="relative">
                <select
                  name="type"
                  className={selectClass}
                  defaultValue={contact?.type ?? "client"}
                >
                  <option value="client">{t("typeClient")}</option>
                  <option value="supplier">{t("typeSupplier")}</option>
                  <option value="both">{t("typeBoth")}</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
            <Field label={t("classification")}>
              <div className="relative">
                <select
                  name="classification"
                  className={selectClass}
                  defaultValue={contact?.classification ?? "business"}
                >
                  <option value="individual">
                    {t("classificationIndividual")}
                  </option>
                  <option value="business">
                    {t("classificationBusiness")}
                  </option>
                  <option value="government">
                    {t("classificationGovernment")}
                  </option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
          </div>
        </section>

        {/* Identity */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("company")}</SectionHeading>
          <div className="grid grid-cols-1 gap-5">
            <Field label={t("company")} required>
              <input
                type="text"
                name="company"
                className={inputClass}
                placeholder="Acme Corp"
                value={companyValue}
                onChange={(e) => setCompanyValue(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label={t("firstName")}>
                <input
                  type="text"
                  name="firstName"
                  className={inputClass}
                  placeholder="John"
                  defaultValue={contact?.firstName ?? ""}
                />
              </Field>
              <Field label={t("lastName")}>
                <input
                  type="text"
                  name="lastName"
                  className={inputClass}
                  placeholder="Doe"
                  defaultValue={contact?.lastName ?? ""}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label={t("email")}>
                <input
                  type="email"
                  name="email"
                  className={inputClass}
                  placeholder="contact@example.com"
                  defaultValue={contact?.email ?? ""}
                />
              </Field>
              <Field label={t("phone")}>
                <input
                  type="tel"
                  name="phone"
                  className={inputClass}
                  placeholder="+30 210 0000000"
                  defaultValue={contact?.phone ?? ""}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* VAT */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("vatNumber")}</SectionHeading>
          <div className="grid grid-cols-1 gap-5">
            <Field label={t("vatNumber")}>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="vatNumber"
                  className={inputClass}
                  placeholder="EL123456789"
                  value={vatValue}
                  onChange={(e) => setVatValue(e.target.value)}
                />
                {capabilities.companyLookup && (
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupPending}
                    className="h-12 px-4 rounded-xl bg-surface-container-high text-on-surface font-label text-sm hover:bg-surface-container-highest transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    {lookupPending ? "..." : t("vatLookup")}
                  </button>
                )}
              </div>
            </Field>
            <input
              type="hidden"
              name="countryCode"
              value={contact?.countryCode ?? ""}
            />
            {capabilities.taxOfficeList && taxOffices && (
              <Field label={t("taxOffice")}>
                <div className="relative">
                  <select
                    name="taxOffice"
                    className={selectClass}
                    value={taxOffice}
                    onChange={(e) => setTaxOffice(e.target.value)}
                  >
                    <option value="">---</option>
                    {taxOffices.map((to) => (
                      <option key={to.code} value={to.name}>
                        {to.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                    expand_more
                  </span>
                </div>
              </Field>
            )}
          </div>
        </section>

        {/* Address */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("address")}</SectionHeading>
          <div className="grid grid-cols-1 gap-5">
            <Field label={t("addressLine1")}>
              <input
                type="text"
                name="addressLine1"
                className={inputClass}
                placeholder="123 Main Street"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </Field>
            <Field label={t("addressLine2")}>
              <input
                type="text"
                name="addressLine2"
                className={inputClass}
                placeholder="Suite 100 (optional)"
                defaultValue={contact?.addressLine2 ?? ""}
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label={t("city")}>
                <input
                  type="text"
                  name="city"
                  className={inputClass}
                  placeholder="Athens"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Field>
              <Field label={t("postalCode")}>
                <input
                  type="text"
                  name="postalCode"
                  className={inputClass}
                  placeholder="10431"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </Field>
              <Field label={t("region")}>
                <input
                  type="text"
                  name="region"
                  className={inputClass}
                  placeholder="Attica"
                  defaultValue={contact?.region ?? ""}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Defaults */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("defaults")}</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label={t("defaultCurrency")}>
              <div className="relative">
                <select
                  name="defaultCurrency"
                  className={selectClass}
                  defaultValue={contact?.defaultCurrency ?? ""}
                >
                  <option value="">---</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="GBP">British Pound (GBP)</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
            <Field label={t("defaultLanguage")}>
              <div className="relative">
                <select
                  name="defaultLanguage"
                  className={selectClass}
                  defaultValue={contact?.defaultLanguage ?? ""}
                >
                  <option value="">---</option>
                  <option value="en">English</option>
                  <option value="el">Greek</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </Field>
            <Field label={t("defaultPaymentTerms")}>
              <input
                type="number"
                name="defaultPaymentTerms"
                className={inputClass}
                placeholder="30"
                min="0"
                max="365"
                defaultValue={contact?.defaultPaymentTerms ?? ""}
              />
            </Field>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
          <SectionHeading>{t("notes")}</SectionHeading>
          <textarea
            name="notes"
            className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:bg-surface-container-high transition-colors min-h-[100px] resize-y"
            placeholder="Internal notes..."
            defaultValue={contact?.notes ?? ""}
          />
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
