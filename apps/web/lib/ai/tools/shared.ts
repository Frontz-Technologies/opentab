type Period = "month" | "quarter" | "year";

export function resolvePeriodRange(input: {
  period: Period;
  year?: number;
  quarter?: number;
  month?: number;
}): { start: Date; end: Date } {
  const now = new Date();
  const year = input.year ?? now.getUTCFullYear();

  if (input.period === "month") {
    const month = (input.month ?? now.getUTCMonth() + 1) - 1;
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    return { start, end };
  }

  if (input.period === "quarter") {
    const quarter = input.quarter ?? Math.floor(now.getUTCMonth() / 3) + 1;
    const startMonth = (quarter - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const end = new Date(Date.UTC(year, startMonth + 3, 0));
    return { start, end };
  }

  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 12, 0)),
  };
}
