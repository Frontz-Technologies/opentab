"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface FreeTextComboboxProps<T> {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: T) => void;
  options: T[];
  getKey: (option: T) => string;
  getLabel: (option: T) => string;
  matches?: (option: T, query: string) => boolean;
  renderOption?: (option: T, query: string) => React.ReactNode;
  maxResults?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function FreeTextCombobox<T>({
  value,
  onChange,
  onSelect,
  options,
  getKey,
  getLabel,
  matches,
  renderOption,
  maxResults = 8,
  placeholder,
  className,
  inputClassName,
}: FreeTextComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!query) return [];
    const filterFn =
      matches ??
      ((opt: T, q: string) => getLabel(opt).toLowerCase().includes(q));
    const out: T[] = [];
    for (const opt of options) {
      if (filterFn(opt, query)) {
        out.push(opt);
        if (out.length >= maxResults) break;
      }
    }
    return out;
  }, [options, query, matches, getLabel, maxResults]);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-md border border-outline/20 bg-surface shadow-lg"
        >
          {filtered.map((opt) => (
            <li
              key={getKey(opt)}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(getLabel(opt));
                onSelect(opt);
                setOpen(false);
              }}
              className="px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high cursor-pointer"
            >
              {renderOption ? renderOption(opt, query) : getLabel(opt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
