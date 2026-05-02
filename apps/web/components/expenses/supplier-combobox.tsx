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
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-on-surface truncate">{c.displayName}</span>
            {(c.company &&
              c.company.toLowerCase() !== c.displayName.toLowerCase()) ||
            c.vatNumber ? (
              <span className="text-xs text-on-surface-variant truncate">
                {[
                  c.company &&
                  c.company.toLowerCase() !== c.displayName.toLowerCase()
                    ? c.company
                    : null,
                  c.vatNumber,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </div>
          {c.type === "both" && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-tertiary/10 text-tertiary">
              both
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
