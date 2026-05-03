import { describe, it, expect } from "vitest";
import { contactsImporter } from "../../lib/import/importers/contacts";

describe("contacts importer descriptor", () => {
  it("derives displayName from company when present", () => {
    const r = contactsImporter.rowSchema.safeParse({
      company: "Acme",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { displayName: string }).displayName).toBe("Acme");
    }
  });

  it("derives displayName from firstName + lastName when no company", () => {
    const r = contactsImporter.rowSchema.safeParse({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as { displayName: string }).displayName).toBe(
        "Ada Lovelace",
      );
    }
  });

  it("rejects rows with no company AND no firstName+lastName", () => {
    const r = contactsImporter.rowSchema.safeParse({
      email: "x@y.com",
    });
    expect(r.success).toBe(false);
  });

  it("idempotency key prefers VAT when present", () => {
    const k = contactsImporter.idempotencyKeyParts(
      {
        company: "Acme",
        displayName: "Acme",
        vatNumber: "EL123456789",
        type: "client",
      } as never,
      "org-1",
    );
    expect(k).toContain("EL123456789".toLowerCase());
  });

  it("idempotency key falls back to email when VAT missing", () => {
    const k = contactsImporter.idempotencyKeyParts(
      {
        company: "Acme",
        displayName: "Acme",
        email: "biz@acme.com",
        type: "client",
      } as never,
      "org-1",
    );
    expect(k).toContain("biz@acme.com");
  });

  it("alias table accepts common header variants", () => {
    expect(contactsImporter.aliases.email).toContain("e-mail");
    expect(contactsImporter.aliases.vatNumber).toContain("vat");
    expect(contactsImporter.aliases.company).toContain("company");
  });
});
