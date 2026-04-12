export interface NumberFormatOptions {
  prefix: string;
  nextNumber: number;
  digitCount: number;
  includeYear: boolean;
  year?: number;
}

export function formatInvoiceNumber(opts: NumberFormatOptions): string {
  const padded = String(opts.nextNumber).padStart(opts.digitCount, "0");

  if (opts.includeYear) {
    const year = opts.year ?? new Date().getFullYear();
    return `${opts.prefix}${year}-${padded}`;
  }

  return `${opts.prefix}${padded}`;
}
