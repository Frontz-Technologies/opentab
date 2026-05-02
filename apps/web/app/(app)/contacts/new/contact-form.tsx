"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Contact } from "@opentab/db/schema";
import type { VatRate, TaxOffice } from "@/lib/country";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequiredFieldsHint } from "@/components/forms/required-fields-hint";
import { createContact, updateContact, lookupVat } from "../actions";
import { isCountrySupportedByAnySource } from "@/lib/business-lookup/registry";
import { detectCountryFromTaxId } from "@/lib/utils";

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

interface ContactFormProps {
  contact?: Contact;
  capabilities: {
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
  const [type, setType] = useState<string>(contact?.type ?? "client");
  const [classification, setClassification] = useState<string>(
    contact?.classification ?? "business",
  );
  const [defaultCurrency, setDefaultCurrency] = useState<string>(
    contact?.defaultCurrency ?? "",
  );
  const [defaultLanguage, setDefaultLanguage] = useState<string>(
    contact?.defaultLanguage ?? "",
  );

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
              <Select value={type} onValueChange={(v) => setType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">{t("typeClient")}</SelectItem>
                  <SelectItem value="supplier">{t("typeSupplier")}</SelectItem>
                  <SelectItem value="both">{t("typeBoth")}</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="type" value={type} />
            </Field>
            <Field label={t("classification")}>
              <Select
                value={classification}
                onValueChange={(v) => setClassification(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">
                    {t("classificationIndividual")}
                  </SelectItem>
                  <SelectItem value="business">
                    {t("classificationBusiness")}
                  </SelectItem>
                  <SelectItem value="government">
                    {t("classificationGovernment")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="classification"
                value={classification}
              />
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
                {isCountrySupportedByAnySource(
                  detectCountryFromTaxId(vatValue.trim()),
                ) && (
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
                <Select
                  value={taxOffice || undefined}
                  onValueChange={(v) => setTaxOffice(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="---" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxOffices.map((to) => (
                      <SelectItem key={to.code} value={to.name}>
                        {to.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="taxOffice" value={taxOffice} />
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
              <Select
                value={defaultCurrency || undefined}
                onValueChange={(v) => setDefaultCurrency(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                  <SelectItem value="USD">US Dollar (USD)</SelectItem>
                  <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="defaultCurrency"
                value={defaultCurrency}
              />
            </Field>
            <Field label={t("defaultLanguage")}>
              <Select
                value={defaultLanguage || undefined}
                onValueChange={(v) => setDefaultLanguage(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="el">Greek</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="defaultLanguage"
                value={defaultLanguage}
              />
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

        <RequiredFieldsHint />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending
              ? tCommon("saving")
              : contact
                ? tCommon("save")
                : t("addContact")}
          </button>
        </div>
      </form>
    </>
  );
}
