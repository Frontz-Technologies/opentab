import { startOfYear, endOfYear, subYears } from "date-fns";

export function getLastYearRange(today: Date): { start: Date; end: Date } {
  const lastYear = subYears(today, 1);
  return {
    start: startOfYear(lastYear),
    end: endOfYear(lastYear),
  };
}
