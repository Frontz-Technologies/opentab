"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { Contact, Product } from "@opentab/db/schema";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineItemsBuilder,
  type LineItem,
} from "@/components/invoicing/line-items-builder";
import { EmptyEntityHint } from "@/components/forms/empty-entity-hint";
import { createInvoice } from "../actions";
import { createContact } from "../../contacts/actions";

interface InvoiceFormProps {
  contacts: Contact[];
  products: Product[];
  defaultCurrency: string;
  defaultTaxRate: string;
}

export function InvoiceForm({
  contacts,
  products,
  defaultCurrency,
  defaultTaxRate,
}: InvoiceFormProps) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [allContacts, setAllContacts] = useState(contacts);
  const [contactId, setContactId] = useState("");
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [newContactClassification, setNewContactClassification] =
    useState<string>("business");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactVat, setNewContactVat] = useState("");
  const [newContactAddress, setNewContactAddress] = useState("");
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [dueDate, setDueDate] = useState("");
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [usesInclusiveTax, setUsesInclusiveTax] = useState(false);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedContact = allContacts.find((c) => c.id === contactId);

  const [rateInfo, setRateInfo] = useState<{
    rate: number;
    effectiveDate: string;
    staleFallback: boolean;
  } | null>(null);

  useEffect(() => {
    if (currencyCode === defaultCurrency || !issueDate) {
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/fx/preview?date=${encodeURIComponent(issueDate)}&from=${encodeURIComponent(currencyCode)}&to=${encodeURIComponent(defaultCurrency)}`,
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
  }, [currencyCode, issueDate, defaultCurrency]);

  function resetCreateContactForm() {
    setNewContactClassification("business");
    setNewContactName("");
    setNewContactEmail("");
    setNewContactVat("");
    setNewContactAddress("");
  }

  async function handleCreateContact() {
    if (!newContactName.trim()) return;
    setIsCreatingContact(true);
    const formData = new FormData();
    formData.set("type", "client");
    formData.set("classification", newContactClassification);
    formData.set("company", newContactName);
    formData.set("email", newContactEmail);
    if (newContactClassification === "business") {
      formData.set("vatNumber", newContactVat);
      formData.set("addressLine1", newContactAddress);
    }
    const result = await createContact(formData);
    if (result.success && result.contact) {
      setAllContacts((prev) => [result.contact!, ...prev]);
      setContactId(result.contact.id);
      setShowCreateContact(false);
      resetCreateContactForm();
    }
    setIsCreatingContact(false);
  }

  function handleSubmit(publish = false) {
    if (!contactId) {
      setError(t("selectClient"));
      return;
    }
    if (items.length === 0) {
      setError(t("itemRequired"));
      return;
    }

    const formData = new FormData();
    formData.set("contactId", contactId);
    formData.set("issueDate", issueDate);
    formData.set("dueDate", dueDate);
    formData.set("currencyCode", currencyCode);
    formData.set("usesInclusiveTax", String(usesInclusiveTax));
    formData.set("contactName", selectedContact?.displayName ?? "");
    formData.set("contactEmail", selectedContact?.email ?? "");
    formData.set("contactVatNumber", selectedContact?.vatNumber ?? "");
    formData.set(
      "contactAddress",
      [
        selectedContact?.addressLine1,
        selectedContact?.addressLine2,
        selectedContact?.city,
        selectedContact?.postalCode,
      ]
        .filter(Boolean)
        .join(", "),
    );
    formData.set("notes", notes);
    formData.set("terms", terms);
    formData.set("internalNotes", internalNotes);
    formData.set("items", JSON.stringify(items));
    if (publish) formData.set("publish", "true");

    startTransition(async () => {
      try {
        const result = await createInvoice(formData);
        if (result.success) {
          router.push("/invoices");
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
          {t("client")} <span className="text-tertiary">*</span>
        </h2>
        {allContacts.length === 0 ? (
          <EmptyEntityHint
            message={t("noClientsYet")}
            ctaLabel={t("createContact")}
            ctaOnClick={() => setShowCreateContact(true)}
          />
        ) : (
          <div className="flex items-stretch gap-2">
            <Select
              value={contactId || undefined}
              onValueChange={(v) => {
                const next = v;
                setContactId(next);
                const contact = allContacts.find((c) => c.id === next);
                if (contact?.defaultCurrency)
                  setCurrencyCode(contact.defaultCurrency);
                if (contact?.defaultPaymentTerms) {
                  const due = new Date(issueDate);
                  due.setDate(due.getDate() + contact.defaultPaymentTerms);
                  setDueDate(due.toISOString().split("T")[0]);
                }
              }}
            >
              <SelectTrigger className="flex-1 min-w-0">
                <SelectValue placeholder={t("selectClient")} />
              </SelectTrigger>
              <SelectContent>
                {allContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setShowCreateContact(true)}
              aria-label={t("createContact")}
              title={t("createContact")}
              className="shrink-0 inline-flex h-auto w-10 items-center justify-center rounded-lg bg-surface-container-low border border-on-surface/10 text-on-surface hover:bg-surface-container hover:text-primary transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}

        <Dialog
          open={showCreateContact}
          onOpenChange={(open) => {
            setShowCreateContact(open);
            if (!open) resetCreateContactForm();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createContact")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-label text-on-surface/60 mb-1">
                  {t("contactClassification")}{" "}
                  <span className="text-tertiary">*</span>
                </label>
                <Select
                  value={newContactClassification}
                  onValueChange={(v) => setNewContactClassification(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">
                      {t("classificationBusiness")}
                    </SelectItem>
                    <SelectItem value="government">
                      {t("classificationGovernment")}
                    </SelectItem>
                    <SelectItem value="individual">
                      {t("classificationIndividual")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-label text-on-surface/60 mb-1">
                  {t("companyName")} <span className="text-tertiary">*</span>
                </label>
                <Input
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              {newContactClassification === "business" && (
                <>
                  <div>
                    <label className="block text-sm font-label text-on-surface/60 mb-1">
                      {t("contactVat")}
                    </label>
                    <Input
                      value={newContactVat}
                      onChange={(e) => setNewContactVat(e.target.value)}
                      placeholder="EL123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-label text-on-surface/60 mb-1">
                      {t("contactAddress")}
                    </label>
                    <Input
                      value={newContactAddress}
                      onChange={(e) => setNewContactAddress(e.target.value)}
                      placeholder="123 Main St, Athens"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-label text-on-surface/60 mb-1">
                  {t("contactEmail")}
                </label>
                <Input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateContact(false)}
                >
                  {t("cancelAction")}
                </Button>
                <Button
                  onClick={handleCreateContact}
                  disabled={isCreatingContact || !newContactName.trim()}
                >
                  {isCreatingContact ? "Creating..." : t("saveAction")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          Details
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("issueDate")} <span className="text-tertiary">*</span>
            </label>
            <DatePicker
              value={issueDate ? parseISO(issueDate) : undefined}
              onChange={(d) => setIssueDate(d ? format(d, "yyyy-MM-dd") : "")}
              name="issueDate"
              ariaLabel={t("issueDate")}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("dueDate")}
            </label>
            <DatePicker
              value={dueDate ? parseISO(dueDate) : undefined}
              onChange={(d) => setDueDate(d ? format(d, "yyyy-MM-dd") : "")}
              name="dueDate"
              ariaLabel={t("dueDate")}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("currency")}
            </label>
            <CurrencyCombobox
              value={currencyCode as SupportedCurrencyCode}
              onChange={(v) => setCurrencyCode(v)}
              name="currencyCode"
              defaultCurrency={defaultCurrency as SupportedCurrencyCode}
            />
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
          products={products}
          defaultTaxRate={defaultTaxRate}
          usesInclusiveTax={usesInclusiveTax}
        />
      </div>

      <div className="bg-surface-container rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-label text-on-surface/60 mb-1">
            {t("notes")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
            placeholder={t("notesHelp")}
          />
        </div>
        <div>
          <label className="block text-sm font-label text-on-surface/60 mb-1">
            {t("terms")}
          </label>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
            placeholder={t("termsHelp")}
          />
        </div>
        <div>
          <label className="block text-sm font-label text-on-surface/60 mb-1">
            {t("internalNotes")}
          </label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
            placeholder={t("internalNotesHelp")}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3 sm:justify-end">
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? t("saving") : t("saveAsDraft")}
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? t("saving") : t("saveAndPublish")}
        </Button>
      </div>
    </div>
  );
}
