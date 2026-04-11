"use client";

import { useRef, useState, useTransition } from "react";
import { useAppSession } from "@/hooks/use-session";
import { detectCountryFromTaxId } from "@/lib/utils";
import { updateCompanySettings } from "./actions";
import { TopBar } from "@/components/layout/top-bar";

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

export default function CompanySettingsPage() {
  const { user, isLoading } = useAppSession();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
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
        setToast({ type: "success", message: "Company settings saved successfully." });
      } catch {
        setToast({ type: "error", message: "Failed to save settings. Please try again." });
      }
      setTimeout(() => setToast(null), 4000);
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-on-surface-variant">progress_activity</span>
      </div>
    );
  }

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Company" },
        ]}
        userName={user?.name ?? ""}
        userEmail={user?.email ?? ""}
      />
      <main className="px-8 py-8 max-w-3xl mx-auto">
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-8">Company Settings</h2>

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

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-10">
          {/* Company Info */}
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
            <SectionHeading>Company Info</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Company Name">
                <input
                  type="text"
                  name="name"
                  className={inputClass}
                  placeholder="Acme Ltd."
                  required
                />
              </Field>
              <Field label="Default Currency">
                <div className="relative">
                  <select name="defaultCurrency" className={selectClass} defaultValue="EUR">
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant">
                    expand_more
                  </span>
                </div>
              </Field>
              <Field label="Fiscal Year Start">
                <div className="relative">
                  <select name="fiscalYearStart" className={selectClass} defaultValue="1">
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
            <SectionHeading>Tax Info</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="VAT / Tax ID"
                hint={detectedCountry ? `Detected country: ${EU_COUNTRIES.find(c => c.code === detectedCountry)?.name ?? detectedCountry}` : "Enter your VAT number (e.g. EL123456789 or 123456789)"}
              >
                <input
                  type="text"
                  name="taxId"
                  className={inputClass}
                  placeholder="EL123456789"
                  onBlur={handleTaxIdBlur}
                />
              </Field>
              <Field label="Tax Authority">
                <input
                  type="text"
                  name="taxAuthority"
                  className={inputClass}
                  placeholder="e.g. AADE"
                />
              </Field>
            </div>
          </section>

          {/* Address */}
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
            <SectionHeading>Address</SectionHeading>
            <div className="grid grid-cols-1 gap-5">
              <Field label="Country">
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
              <Field label="Address Line 1">
                <input
                  type="text"
                  name="addressLine1"
                  className={inputClass}
                  placeholder="123 Main Street"
                />
              </Field>
              <Field label="Address Line 2">
                <input
                  type="text"
                  name="addressLine2"
                  className={inputClass}
                  placeholder="Suite 100 (optional)"
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Field label="City">
                  <input type="text" name="city" className={inputClass} placeholder="Athens" />
                </Field>
                <Field label="Postal Code">
                  <input type="text" name="postalCode" className={inputClass} placeholder="10431" />
                </Field>
                <Field label="Region / State">
                  <input type="text" name="region" className={inputClass} placeholder="Attica" />
                </Field>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-5">
            <SectionHeading>Contact</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Phone Number">
                <input
                  type="tel"
                  name="phone"
                  className={inputClass}
                  placeholder="+30 210 0000000"
                />
              </Field>
            </div>
          </section>

          {/* Branding */}
          <section className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10">
            <SectionHeading>Branding</SectionHeading>
            <div className="flex flex-col items-center justify-center min-h-[120px] rounded-xl border-2 border-dashed border-outline-variant/30 text-on-surface/30 gap-2">
              <span className="material-symbols-outlined text-3xl">image</span>
              <p className="text-sm font-medium">Logo upload coming soon</p>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="h-12 px-8 rounded-xl btn-gradient text-on-primary font-bold text-sm transition-transform active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
