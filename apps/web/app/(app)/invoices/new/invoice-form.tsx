"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Contact, Product } from "@opentab/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      const result = await createInvoice(formData);
      if (result.success) {
        router.push("/invoices");
      } else {
        setError(JSON.stringify(result.error));
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
        <div className="flex items-stretch gap-2">
          <select
            value={contactId}
            onChange={(e) => {
              setContactId(e.target.value);
              const contact = allContacts.find((c) => c.id === e.target.value);
              if (contact?.defaultCurrency)
                setCurrencyCode(contact.defaultCurrency);
              if (contact?.defaultPaymentTerms) {
                const due = new Date(issueDate);
                due.setDate(due.getDate() + contact.defaultPaymentTerms);
                setDueDate(due.toISOString().split("T")[0]);
              }
            }}
            className="flex-1 min-w-0 rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
          >
            <option value="">{t("selectClient")}</option>
            {allContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowCreateContact(true)}
            aria-label={t("createContact")}
            title={t("createContact")}
            className="shrink-0 inline-flex h-auto w-10 items-center justify-center rounded-lg bg-surface-container-low border border-on-surface/10 text-on-surface hover:bg-surface-container hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>

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
                <select
                  value={newContactClassification}
                  onChange={(e) => setNewContactClassification(e.target.value)}
                  className="w-full rounded-lg bg-surface-container-low border border-on-surface/10 px-3 py-2 text-sm text-on-surface"
                >
                  <option value="business">
                    {t("classificationBusiness")}
                  </option>
                  <option value="government">
                    {t("classificationGovernment")}
                  </option>
                  <option value="individual">
                    {t("classificationIndividual")}
                  </option>
                </select>
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
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-label text-on-surface/60 mb-1">
              {t("dueDate")}
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={isPending}
        >
          {isPending ? "Saving..." : t("saveAsDraft")}
        </Button>
        <Button onClick={() => handleSubmit(true)} disabled={isPending}>
          {isPending ? "Saving..." : t("saveAndPublish")}
        </Button>
      </div>
    </div>
  );
}
