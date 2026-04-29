"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type { DateRange };

export interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  displayFormat?: string;
  numberOfMonths?: number;
  triggerClassName?: string;
  ariaLabel?: string;
  /** Optional names for FormData round-tripping; emit hidden ISO inputs. */
  fromName?: string;
  toName?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a range",
  displayFormat = "yyyy-MM-dd",
  numberOfMonths = 2,
  triggerClassName,
  ariaLabel,
  fromName,
  toName,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const fmt = (d?: Date) => (d ? format(d, displayFormat) : "");

  return (
    <>
      {fromName ? (
        <input type="hidden" name={fromName} value={fmt(value?.from)} />
      ) : null}
      {toName ? (
        <input type="hidden" name={toName} value={fmt(value?.to)} />
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label={ariaLabel}
              className={cn(
                "w-full justify-start text-left font-normal",
                !value?.from && "text-muted-foreground",
                triggerClassName,
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value?.from ? (
                value.to ? (
                  <>
                    {fmt(value.from)} — {fmt(value.to)}
                  </>
                ) : (
                  fmt(value.from)
                )
              ) : (
                <span>{placeholder}</span>
              )}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={numberOfMonths}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
