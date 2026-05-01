"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SupplierContactOption } from "./supplier-combobox";

export interface ContactQuickCreatePrefill {
  supplierName: string;
  supplierVat: string;
  address?: string;
  city?: string;
  postalCode?: string;
  taxOffice?: string;
}

export interface ContactQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: ContactQuickCreatePrefill;
  createSupplierContact: (input: ContactQuickCreatePrefill) => Promise<{
    success: boolean;
    contact?: SupplierContactOption;
    error?: string;
  }>;
  onSaved: (contact: SupplierContactOption) => void;
}

export function ContactQuickCreateDialog({
  open,
  onOpenChange,
  prefill,
  createSupplierContact,
  onSaved,
}: ContactQuickCreateDialogProps) {
  const t = useTranslations("contacts");
  const tCommon = useTranslations("common");
  const [name, setName] = React.useState(prefill.supplierName);
  const [vat, setVat] = React.useState(prefill.supplierVat);
  const [address, setAddress] = React.useState(prefill.address ?? "");
  const [city, setCity] = React.useState(prefill.city ?? "");
  const [postalCode, setPostalCode] = React.useState(prefill.postalCode ?? "");
  const [taxOffice, setTaxOffice] = React.useState(prefill.taxOffice ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName(prefill.supplierName);
      setVat(prefill.supplierVat);
      setAddress(prefill.address ?? "");
      setCity(prefill.city ?? "");
      setPostalCode(prefill.postalCode ?? "");
      setTaxOffice(prefill.taxOffice ?? "");
      setError(null);
    }
  }, [open, prefill]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const out = await createSupplierContact({
      supplierName: name,
      supplierVat: vat,
      address,
      city,
      postalCode,
      taxOffice,
    });
    setPending(false);
    if (out.success && out.contact) {
      onSaved(out.contact);
      onOpenChange(false);
    } else {
      setError(out.error ?? "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addContactDialogTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("contactName")}
            required
          />
          <Input
            value={vat}
            onChange={(e) => setVat(e.target.value)}
            placeholder={t("vatNumber")}
          />
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("addressLine1")}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("city")}
            />
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder={t("postalCode")}
            />
          </div>
          <Input
            value={taxOffice}
            onChange={(e) => setTaxOffice(e.target.value)}
            placeholder={t("taxOffice")}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "..." : tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
