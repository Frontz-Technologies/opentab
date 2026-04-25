import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@opentab/db/test-utils";
import { z } from "zod";
import { organisations, contacts } from "@opentab/db/schema";
import { runImport } from "../../lib/import/core/runner";
import type { ImporterDescriptor } from "../../lib/import/core/types";

interface ContactInput extends Record<string, unknown> {
  displayName: string;
  email?: string;
}

const descriptor: ImporterDescriptor<ContactInput> = {
  entityKey: "contacts",
  label: "Contacts",
  fields: [
    { name: "displayName", required: true, type: "string" },
    { name: "email", required: false, type: "string" },
  ],
  aliases: { displayName: ["name"], email: ["email"] },
  rowSchema: z.object({
    displayName: z.string().min(1),
    email: z.string().email().optional(),
  }),
  idempotencyKeyParts: (row, orgId) => [
    orgId,
    (row.email ?? row.displayName).toLowerCase(),
  ],
};

describe("runImport (#215)", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let teardown: () => Promise<void>;
  let orgId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    db = ctx.db;
    teardown = ctx.teardown;
    const [org] = await db
      .insert(organisations)
      .values({ name: "Test", slug: "t-runner", countryCode: "GR" })
      .returning();
    orgId = org.id;
  });

  afterAll(async () => teardown());

  it("inserts ok rows + returns counters", async () => {
    const result = await runImport({
      orgId,
      descriptor,
      rows: [
        {
          kind: "ok",
          rowNumber: 2,
          data: { displayName: "Ada", email: "ada@x.io" },
          idempotencyKey: "k-ada",
        },
        {
          kind: "ok",
          rowNumber: 3,
          data: { displayName: "Grace", email: "grace@x.io" },
          idempotencyKey: "k-grace",
        },
      ],
      skippedByUser: new Set(),
      table: contacts,
      buildInsert: (row) => ({
        orgId,
        displayName: row.displayName,
        email: row.email ?? null,
      }),
      dbInstance: db,
    });
    expect(result.created).toBe(2);
    expect(result.skippedDup).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("skips rows whose idempotency key already exists (ON CONFLICT)", async () => {
    const first = await runImport({
      orgId,
      descriptor,
      rows: [
        {
          kind: "ok",
          rowNumber: 2,
          data: { displayName: "Linus" },
          idempotencyKey: "k-linus",
        },
      ],
      skippedByUser: new Set(),
      table: contacts,
      buildInsert: (row) => ({ orgId, displayName: row.displayName }),
      dbInstance: db,
    });
    expect(first.created).toBe(1);

    const second = await runImport({
      orgId,
      descriptor,
      rows: [
        {
          kind: "ok",
          rowNumber: 2,
          data: { displayName: "Linus" },
          idempotencyKey: "k-linus",
        },
      ],
      skippedByUser: new Set(),
      table: contacts,
      buildInsert: (row) => ({ orgId, displayName: row.displayName }),
      dbInstance: db,
    });
    expect(second.created).toBe(0);
    expect(second.skippedDup).toBe(1);
  });

  it("respects skippedByUser set", async () => {
    const result = await runImport({
      orgId,
      descriptor,
      rows: [
        {
          kind: "ok",
          rowNumber: 2,
          data: { displayName: "Skip Me" },
          idempotencyKey: "k-skip",
        },
      ],
      skippedByUser: new Set([2]),
      table: contacts,
      buildInsert: (row) => ({ orgId, displayName: row.displayName }),
      dbInstance: db,
    });
    expect(result.created).toBe(0);
    expect(result.skippedByUser).toBe(1);
  });

  it("emits an error CSV when there are blocked rows", async () => {
    const result = await runImport({
      orgId,
      descriptor,
      rows: [
        {
          kind: "blocked",
          rowNumber: 5,
          raw: { displayName: "", email: "x" },
          messages: ["displayName: required", "email: invalid"],
        },
      ],
      skippedByUser: new Set(),
      table: contacts,
      buildInsert: (row) => ({ orgId, displayName: row.displayName }),
      dbInstance: db,
    });
    expect(result.failed).toBe(1);
    expect(result.errorCsv).not.toBeNull();
    expect(result.errorCsv).toContain("row_number");
    expect(result.errorCsv).toContain("5");
    expect(result.errorCsv).toContain("displayName: required");
  });
});
