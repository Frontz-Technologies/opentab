"use client";

import * as React from "react";
import { FreeTextCombobox } from "@/components/ui/free-text-combobox";

export interface SupplierContactOption {
  id: string;
  displayName: string;
  company: string | null;
  vatNumber: string | null;
  type: string;
}

export interface SupplierComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (contact: SupplierContactOption) => void;
  contacts: SupplierContactOption[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

const SUPPLIER_TYPES = new Set(["supplier", "both"]);

function matchesSupplier(
  contact: SupplierContactOption,
  query: string,
): boolean {
  if (!SUPPLIER_TYPES.has(contact.type)) return false;
  const haystack = [
    contact.displayName,
    contact.company ?? "",
    contact.vatNumber ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function SupplierCombobox({
  value,
  onChange,
  onSelect,
  contacts,
  placeholder,
  className,
  inputClassName,
}: SupplierComboboxProps) {
  return (
    <FreeTextCombobox<SupplierContactOption>
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      options={contacts}
      getKey={(c) => c.id}
      getLabel={(c) => c.displayName}
      matches={matchesSupplier}
      renderOption={(c) => (
        <div className="flex flex-col">
          <span className="text-on-surface">{c.displayName}</span>
          {(c.company || c.vatNumber) && (
            <span className="text-xs text-on-surface-variant">
              {[c.company, c.vatNumber].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      )}
      maxResults={8}
      placeholder={placeholder}
      className={className}
      inputClassName={inputClassName}
    />
  );
}
