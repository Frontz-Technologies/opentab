import { describe, it, expect } from "vitest";
import { resolveHeader } from "../../lib/import/core/alias-table";

describe("resolveHeader (#215)", () => {
  const aliases = {
    email: ["email", "e-mail", "e mail", "correo"],
    vatNumber: ["vat", "vat #", "vat number", "afm"],
  };

  it("matches case-insensitive", () => {
    expect(resolveHeader("EMAIL", aliases)).toBe("email");
    expect(resolveHeader("Email", aliases)).toBe("email");
  });

  it("matches alternates with different whitespace/punctuation", () => {
    expect(resolveHeader("e-mail", aliases)).toBe("email");
    expect(resolveHeader("VAT #", aliases)).toBe("vatNumber");
    expect(resolveHeader("AFM", aliases)).toBe("vatNumber");
  });

  it("returns null when nothing matches", () => {
    expect(resolveHeader("phone", aliases)).toBeNull();
  });

  it("trims surrounding whitespace before comparing", () => {
    expect(resolveHeader("  email  ", aliases)).toBe("email");
  });
});
