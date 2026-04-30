import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  expenses,
  expenseAttachments,
} from "@opentab/db/schema";

// Issue #274 — cross-org audit. The duplicate-receipt guard at
// uploadAndExtractReceipt previously matched expense_attachment.file_hash
// with no scope, so an attachment owned by Org B would block Org A from
// uploading the same file. Worse: it leaked existence (the error message
// "This file has already been uploaded" confirms B has that file).
//
// expense_attachment has no orgId column — the fix joins through
// expense.orgId.

const { dbHolder, getSessionMock } = vi.hoisted(() => ({
  dbHolder: {
    current: null as unknown as Awaited<
      ReturnType<typeof import("@opentab/db/test-utils").createTestDb>
    >["db"],
  },
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return dbHolder.current;
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Disable AI extraction so the action returns immediately after the
// duplicate check + file store — the test only cares about the dup gate.
vi.mock("@/lib/actions/ai-settings", () => ({
  isReceiptExtractionEnabled: vi.fn().mockResolvedValue(false),
  getAiSettingsSecret: vi.fn().mockResolvedValue(null),
}));

import { uploadAndExtractReceipt } from "@/app/(app)/expenses/actions";

describe("uploadAndExtractReceipt duplicate guard — cross-org isolation (#274)", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let uploadsDir: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({
        name: "Org A",
        slug: "org-a-attach-274",
        countryCode: "GR",
      })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({
        name: "Org B",
        slug: "org-b-attach-274",
        countryCode: "GR",
      })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    // Seed an expense + attachment in Org B with a known file hash.
    const [orgBExpense] = await ctx.db
      .insert(expenses)
      .values({
        orgId: orgBId,
        expenseNumber: "EXP-B-0001",
        expenseDate: "2026-04-01",
        currencyCode: "EUR",
      })
      .returning();
    await ctx.db.insert(expenseAttachments).values({
      expenseId: orgBExpense.id,
      filePath: `${orgBId}/expenses/${orgBExpense.id}.pdf`,
      fileName: "receipt.pdf",
      mimeType: "application/pdf",
      fileSize: 5,
      // sha256("hello") — also what computeFileHash will return for the
      // "hello" buffer the action receives below.
      fileHash:
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    });
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), "opentab-cross-org-attach-"));
    process.env.UPLOADS_DIR = uploadsDir;
    delete process.env.S3_ENDPOINT;
    getSessionMock.mockReset();
  });

  afterEach(async () => {
    await rm(uploadsDir, { recursive: true, force: true }).catch(() => {});
    delete process.env.UPLOADS_DIR;
  });

  function ownerSession(orgId: string) {
    return {
      user: {
        id: "u1",
        email: "u1@e",
        name: "User",
        locale: "en",
      },
      role: "owner",
      org: {
        id: orgId,
        name: "Org",
        slug: "org",
        countryCode: "GR",
        defaultCurrency: "EUR",
        fiscalYearStart: 1,
        taxId: null,
        taxAuthority: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        region: null,
        phone: null,
        setupCompletedSteps: [],
        isDemo: false,
      },
    };
  }

  function makeFormData(): FormData {
    const fd = new FormData();
    fd.set(
      "file",
      new File(["hello"], "receipt.pdf", { type: "application/pdf" }),
    );
    return fd;
  }

  it("does NOT block Org A's upload when Org B already has the same file hash", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    const result = await uploadAndExtractReceipt(makeFormData());

    expect(result.success).toBe(true);
    expect(result.fileInfo?.fileHash).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("DOES block Org B from re-uploading the same file (in-org dup guard still works)", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgBId));

    const result = await uploadAndExtractReceipt(makeFormData());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already been uploaded/);
  });
});
