import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateRows } from "../../lib/import/core/validator";
import type { ImporterDescriptor } from "../../lib/import/core/types";

const descriptor: ImporterDescriptor<{
  email: string;
  firstName: string;
}> = {
  entityKey: "test",
  label: "Test",
  fields: [
    { name: "firstName", required: true, type: "string" },
    { name: "email", required: true, type: "string" },
  ],
  aliases: { email: ["email"], firstName: ["firstName"] },
  rowSchema: z.object({
    firstName: z.string().min(1),
    email: z.string().email(),
  }),
  idempotencyKeyParts: (row, orgId) => [orgId, row.email.toLowerCase()],
};

describe("validateRows (#215)", () => {
  it("returns ok for a row that parses cleanly", () => {
    const rows = [{ firstName: "Ada", email: "ada@example.com" }];
    const mapping = { firstName: "firstName", email: "email" };
    const results = validateRows(rows, mapping, descriptor, "org-1");
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe("ok");
    if (results[0].kind === "ok") {
      expect(results[0].data).toEqual({
        firstName: "Ada",
        email: "ada@example.com",
      });
      expect(results[0].rowNumber).toBe(2);
      expect(results[0].idempotencyKey).toBeTruthy();
    }
  });

  it("returns blocked for a row missing a required field", () => {
    const rows = [{ firstName: "Ada", email: "" }];
    const mapping = { firstName: "firstName", email: "email" };
    const results = validateRows(rows, mapping, descriptor, "org-1");
    expect(results[0].kind).toBe("blocked");
    if (results[0].kind === "blocked") {
      expect(results[0].messages.join(" ")).toMatch(/email/i);
    }
  });

  it("ignores columns mapped to null (skipped by user)", () => {
    const rows = [
      { firstName: "Ada", email: "ada@example.com", phone: "555-0000" },
    ];
    const mapping = {
      firstName: "firstName",
      email: "email",
      phone: null,
    };
    const results = validateRows(rows, mapping, descriptor, "org-1");
    expect(results[0].kind).toBe("ok");
  });

  it("each idempotency key is deterministic across runs", () => {
    const rows = [{ firstName: "Ada", email: "ada@example.com" }];
    const mapping = { firstName: "firstName", email: "email" };
    const a = validateRows(rows, mapping, descriptor, "org-1");
    const b = validateRows(rows, mapping, descriptor, "org-1");
    if (a[0].kind === "ok" && b[0].kind === "ok") {
      expect(a[0].idempotencyKey).toBe(b[0].idempotencyKey);
    }
  });
});
