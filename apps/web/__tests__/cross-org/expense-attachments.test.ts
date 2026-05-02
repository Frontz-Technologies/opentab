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
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import {
  organisations,
  expenses,
  expenseAttachments,
} from "@opentab/db/schema";

// Cross-org isolation for the duplicate-receipt guard at
// uploadAndExtractReceipt. The matcher must scope file_hash to the
// caller's org or it would (a) block Org A from uploading a file Org
// B already has and (b) leak existence ("This file has already been
// uploaded" confirms B has that file).
//
// expense_attachment has no orgId column — the lookup joins through
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

describe("uploadAndExtractReceipt duplicate guard — cross-org isolation", () => {
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
    if (result.success) {
      expect(result.fileInfo.fileHash).toBe(
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      );
    }
  });

  it("DOES block Org B from re-uploading the same file (in-org dup guard still works)", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgBId));

    const result = await uploadAndExtractReceipt(makeFormData());

    expect(result.success).toBe(false);
    // Duplicate-receipt branch reports error="duplicate" with the
    // parent expenseId so the client can offer "open existing expense"
    // UX. The duplicate-branch object has a `duplicateExpenseId`
    // property; runtime discriminate on its presence (the union has
    // two failure shapes — string error vs the dup branch).
    if (!result.success && "duplicateExpenseId" in result) {
      expect(result.error).toBe("duplicate");
      expect(result.duplicateExpenseId).toBeDefined();
      // The dup is expected to point at the previously-seeded Org B
      // expense, which the test creates in beforeAll. The id matches
      // because the JOIN-through-expenses filter already constrained
      // the result to same-org rows.
      const sameOrgExpenses = await dbHolder.current
        .select()
        .from(expenses)
        .where(eq(expenses.id, result.duplicateExpenseId));
      expect(sameOrgExpenses).toHaveLength(1);
      expect(sameOrgExpenses[0].orgId).toBe(orgBId);
    } else {
      throw new Error(
        `expected duplicate branch, got ${JSON.stringify(result)}`,
      );
    }
  });

  it("Org A reuploading their own file gets duplicate=true with their own expenseId", async () => {
    // Seed an Org A expense + attachment with the same file hash.
    const [orgAExpense] = await dbHolder.current
      .insert(expenses)
      .values({
        orgId: orgAId,
        expenseNumber: "EXP-A-DUP-0001",
        expenseDate: "2026-04-01",
        currencyCode: "EUR",
      })
      .returning();
    await dbHolder.current.insert(expenseAttachments).values({
      expenseId: orgAExpense.id,
      filePath: `${orgAId}/expenses/${orgAExpense.id}.pdf`,
      fileName: "receipt.pdf",
      mimeType: "application/pdf",
      fileSize: 5,
      fileHash:
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    });

    getSessionMock.mockResolvedValue(ownerSession(orgAId));
    const result = await uploadAndExtractReceipt(makeFormData());

    expect(result.success).toBe(false);
    if (!result.success && "duplicateExpenseId" in result) {
      // Critical: the projection must point at Org A's expense, not
      // Org B's pre-seeded expense with the same file hash.
      expect(result.duplicateExpenseId).toBe(orgAExpense.id);
    } else {
      throw new Error(
        `expected duplicate branch, got ${JSON.stringify(result)}`,
      );
    }
  });
});
