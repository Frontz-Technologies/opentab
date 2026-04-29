"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  displayFormat?: string;
  disabled?: boolean;
  triggerClassName?: string;
  ariaLabel?: string;
  /** Optional `name` for forms that read the date via FormData. */
  name?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  displayFormat = "yyyy-MM-dd",
  disabled,
  triggerClassName,
  ariaLabel,
  name,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value ? format(value, "yyyy-MM-dd") : ""}
        />
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={ariaLabel}
              className={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
                triggerClassName,
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? (
                format(value, displayFormat)
              ) : (
                <span>{placeholder}</span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d);
              if (d) setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
