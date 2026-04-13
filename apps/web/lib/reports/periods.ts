import {
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  subDays,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import type { PeriodKey, DateRange } from "./types";

export function periodToDateRange(period: PeriodKey): DateRange {
  const now = new Date();
  switch (period) {
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "30days":
      return { start: subDays(now, 30), end: now };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "all":
      return { start: new Date(2000, 0, 1), end: now };
  }
}

export function previousPeriodRange(period: PeriodKey): DateRange | null {
  if (period === "all") return null;
  const current = periodToDateRange(period);
  switch (period) {
    case "month": {
      const prev = subMonths(current.start, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case "30days": {
      const end = subDays(current.start, 1);
      return { start: subDays(end, 29), end };
    }
    case "quarter": {
      const prev = subQuarters(current.start, 1);
      return { start: startOfQuarter(prev), end: endOfQuarter(prev) };
    }
    case "year": {
      const prev = subYears(current.start, 1);
      return { start: startOfYear(prev), end: endOfYear(prev) };
    }
  }
}

export function timeBucket(period: PeriodKey): "day" | "week" | "month" {
  switch (period) {
    case "month":
    case "30days":
      return "day";
    case "quarter":
      return "week";
    case "year":
    case "all":
      return "month";
  }
}
