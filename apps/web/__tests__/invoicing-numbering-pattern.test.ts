import { describe, it, expect } from "vitest";
import { renderInvoiceNumberPattern } from "../lib/invoicing/numbering";

describe("renderInvoiceNumberPattern", () => {
  const baseOpts = {
    pattern: "",
    prefix: "INV-",
    nextNumber: 42,
    year: 2026,
    month: 4,
  };

  it("resolves {prefix} to the prefix verbatim", () => {
    expect(
      renderInvoiceNumberPattern({ ...baseOpts, pattern: "{prefix}001" }),
    ).toBe("INV-001");
  });

  it("resolves {year} to the 4-digit year", () => {
    expect(
      renderInvoiceNumberPattern({ ...baseOpts, pattern: "{year}-X" }),
    ).toBe("2026-X");
  });

  it("resolves {month} to the 2-digit zero-padded month", () => {
    expect(
      renderInvoiceNumberPattern({ ...baseOpts, pattern: "{month}-X" }),
    ).toBe("04-X");
  });

  it("resolves {counter} to the plain integer", () => {
    expect(
      renderInvoiceNumberPattern({ ...baseOpts, pattern: "{counter}" }),
    ).toBe("42");
  });

  it("resolves {counter:N} to the zero-padded counter", () => {
    expect(
      renderInvoiceNumberPattern({ ...baseOpts, pattern: "{counter:4}" }),
    ).toBe("0042");
    expect(
      renderInvoiceNumberPattern({ ...baseOpts, pattern: "{counter:6}" }),
    ).toBe("000042");
  });

  it("renders a realistic compound pattern", () => {
    expect(
      renderInvoiceNumberPattern({
        ...baseOpts,
        pattern: "{prefix}{year}-{counter:4}",
      }),
    ).toBe("INV-2026-0042");
  });

  it("leaves unknown text literal", () => {
    expect(
      renderInvoiceNumberPattern({
        ...baseOpts,
        pattern: "ACME/{year}/{counter:3}",
      }),
    ).toBe("ACME/2026/042");
  });

  it("renders multiple occurrences of the same placeholder", () => {
    expect(
      renderInvoiceNumberPattern({
        ...baseOpts,
        pattern: "{year}-{year}-{counter}",
      }),
    ).toBe("2026-2026-42");
  });

  it("does not greedily match {counter:N} into {counter}", () => {
    expect(
      renderInvoiceNumberPattern({
        ...baseOpts,
        pattern: "{counter:4}-{counter}",
      }),
    ).toBe("0042-42");
  });

  // String.prototype.replace treats $&, $1, $$, $<…> in the *string*
  // second argument as regex backreferences, which would corrupt the
  // rendered number when a user enters those characters as a prefix.
  // We pass a function callback so they round-trip literally.
  it("treats regex-special characters in the prefix as literals", () => {
    expect(
      renderInvoiceNumberPattern({
        pattern: "{prefix}{counter}",
        prefix: "$&-",
        nextNumber: 7,
      }),
    ).toBe("$&-7");
    expect(
      renderInvoiceNumberPattern({
        pattern: "{prefix}{counter}",
        prefix: "$1$$",
        nextNumber: 7,
      }),
    ).toBe("$1$$7");
  });

  it("defaults year/month to the current date when not supplied", () => {
    const now = new Date();
    const expectedYear = now.getFullYear().toString();
    const out = renderInvoiceNumberPattern({
      pattern: "{year}",
      prefix: "X",
      nextNumber: 1,
    });
    expect(out).toBe(expectedYear);
  });
});
