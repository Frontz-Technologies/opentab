"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface ComboboxOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  groupKey?: string;
  groupLabel?: string;
  disabled?: boolean;
}

export interface ComboboxProps<T extends string = string> {
  options: ComboboxOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Combobox<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  triggerClassName,
  contentClassName,
  disabled,
  ariaLabel,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const groups = React.useMemo(() => {
    const out = new Map<
      string,
      { label: string; items: ComboboxOption<T>[] }
    >();
    for (const opt of options) {
      const key = opt.groupKey ?? "__ungrouped__";
      const existing = out.get(key);
      if (existing) {
        existing.items.push(opt);
      } else {
        out.set(key, { label: opt.groupLabel ?? "", items: [opt] });
      }
    }
    return out;
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              triggerClassName,
            )}
          >
            <span className="truncate">
              {selected ? selected.label : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent
        className={cn("w-(--popover-trigger-width) p-0", contentClassName)}
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {Array.from(groups.entries()).map(([key, { label, items }]) => (
              <CommandGroup
                key={key}
                heading={
                  key === "__ungrouped__" ? undefined : label || undefined
                }
              >
                {items.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.description ?? ""}`}
                    disabled={opt.disabled}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      {opt.description ? (
                        <span className="text-xs text-muted-foreground">
                          {opt.description}
                        </span>
                      ) : null}
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        opt.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
