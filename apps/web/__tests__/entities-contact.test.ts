import { describe, it, expect } from "vitest";
import {
  createContactSchema,
  updateContactSchema,
} from "@/lib/entities/contact";

const validContact = {
  type: "client" as const,
  classification: "business" as const,
  company: "Acme Ltd",
};

describe("contact entity schemas", () => {
  it("createContactSchema accepts a minimal valid payload", () => {
    const parsed = createContactSchema.safeParse(validContact);
    expect(parsed.success).toBe(true);
  });

  it("createContactSchema rejects an invalid type enum", () => {
    const parsed = createContactSchema.safeParse({
      ...validContact,
      type: "vendor",
    });
    expect(parsed.success).toBe(false);
  });

  it("updateContactSchema matches createContactSchema behaviour", () => {
    expect(updateContactSchema.safeParse(validContact).success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    const parsed = createContactSchema.safeParse({
      ...validContact,
      email: "not-an-email",
    });
    expect(parsed.success).toBe(false);
  });
});
