export interface NumberFormatOptions {
  prefix: string;
  nextNumber: number;
  digitCount: number;
  includeYear: boolean;
  year?: number;
  pattern?: string | null;
}

export interface RenderPatternOptions {
  pattern: string;
  prefix: string;
  nextNumber: number;
  year?: number;
  month?: number;
}

// Resolves a numbering pattern string into the final invoice number.
// Pure function — no DB, no env reads. Order of substitution matters:
// {counter:N} (longest) is matched before {counter} (shortest) so the
// short placeholder doesn't swallow the prefix of the long one.
export function renderInvoiceNumberPattern(opts: RenderPatternOptions): string {
  const now = new Date();
  const year = (opts.year ?? now.getFullYear()).toString();
  const month = String(opts.month ?? now.getMonth() + 1).padStart(2, "0");

  let out = opts.pattern;
  // {counter:N} first — N is 1..10 by validation; renderer is
  // permissive in case future grammar widens.
  out = out.replace(/\{counter:(\d+)\}/g, (_, n: string) => {
    const width = parseInt(n, 10);
    return String(opts.nextNumber).padStart(width, "0");
  });
  out = out.replace(/\{counter\}/g, () => String(opts.nextNumber));
  // Function callbacks for the next three so user-supplied prefix or
  // future placeholder values can't be interpreted as $&, $1, $$ regex
  // backreferences inside String.prototype.replace.
  out = out.replace(/\{prefix\}/g, () => opts.prefix);
  out = out.replace(/\{year\}/g, () => year);
  out = out.replace(/\{month\}/g, () => month);
  return out;
}

export function formatInvoiceNumber(opts: NumberFormatOptions): string {
  if (opts.pattern) {
    return renderInvoiceNumberPattern({
      pattern: opts.pattern,
      prefix: opts.prefix,
      nextNumber: opts.nextNumber,
      year: opts.year,
    });
  }

  // Fallback: existing simple-mode behaviour, byte-for-byte unchanged.
  const padded = String(opts.nextNumber).padStart(opts.digitCount, "0");
  if (opts.includeYear) {
    const year = opts.year ?? new Date().getFullYear();
    return `${opts.prefix}${year}-${padded}`;
  }
  return `${opts.prefix}${padded}`;
}
