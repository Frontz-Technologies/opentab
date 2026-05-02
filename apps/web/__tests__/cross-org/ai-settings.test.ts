import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@opentab/db/test-utils";
import { organisations, aiSettings } from "@opentab/db/schema";

// Defence-in-depth on aiSettings updates. updateAiSettings selects
// `existing` by orgId (good) and the mutation also carries orgId in
// the WHERE. deleteApiKey throws Forbidden on a caller-supplied orgId
// mismatch.

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

import { deleteApiKey } from "@/lib/actions/ai-settings";

describe("aiSettings — cross-org isolation (#274)", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-ai-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-ai-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    // Org B has an api key configured.
    await ctx.db.insert(aiSettings).values({
      orgId: orgBId,
      enabled: true,
      apiKeyEncrypted: "encrypted-blob-B",
      apiKeyIv: "iv-B",
      apiKeyLast4: "BBBB",
    });
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(() => {
    getSessionMock.mockReset();
  });

  function ownerSession(orgId: string) {
    return {
      user: { id: "u1", email: "u1@e", name: "User", locale: "en" },
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

  it("Org A calling deleteApiKey(orgB.id) is rejected and Org B's key survives", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgAId));

    await expect(deleteApiKey(orgBId)).rejects.toThrow("Forbidden");

    const [row] = await dbHolder.current
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.orgId, orgBId));
    expect(row.apiKeyEncrypted).toBe("encrypted-blob-B");
    expect(row.apiKeyLast4).toBe("BBBB");
  });

  it("Org B calling deleteApiKey(orgB.id) clears Org B's own key (sanity check)", async () => {
    getSessionMock.mockResolvedValue(ownerSession(orgBId));

    const result = await deleteApiKey(orgBId);
    expect(result.success).toBe(true);

    const [row] = await dbHolder.current
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.orgId, orgBId));
    expect(row.apiKeyEncrypted).toBeNull();
    expect(row.apiKeyLast4).toBeNull();
  });
});
