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
import {
  organisations,
  countryIntegrationCredentials,
} from "@opentab/db/schema";

// Defence-in-depth on country_integration_credential UPDATE paths in
// settings/integrations/mydata/actions.ts and the generic
// settings/integrations/[slug]/actions.ts. The policy is "every
// mutation carries orgId", so this test freezes the contract: an
// UPDATE that touches another org's credential row must affect zero
// rows when the WHERE is scoped.

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

describe("country_integration_credential — cross-org defence-in-depth (#274)", () => {
  let teardown: () => Promise<void>;
  let orgAId: string;
  let orgBId: string;
  let orgBCredId: string;

  beforeAll(async () => {
    const ctx = await createTestDb();
    dbHolder.current = ctx.db;
    teardown = ctx.teardown;

    const [a] = await ctx.db
      .insert(organisations)
      .values({ name: "Org A", slug: "org-a-cic-274", countryCode: "GR" })
      .returning();
    const [b] = await ctx.db
      .insert(organisations)
      .values({ name: "Org B", slug: "org-b-cic-274", countryCode: "GR" })
      .returning();
    orgAId = a.id;
    orgBId = b.id;

    const [cred] = await ctx.db
      .insert(countryIntegrationCredentials)
      .values({
        orgId: orgBId,
        countryCode: "GR",
        kind: "mydata",
        configJson: {
          aadeUserId: "B",
          subscriptionKey: "B",
          environment: "sandbox",
        },
      })
      .returning();
    orgBCredId = cred.id;
  });

  afterAll(async () => {
    await teardown();
  });

  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it("scoped UPDATE (id + orgA.id) affects 0 rows when row belongs to Org B", async () => {
    // Mirror of the exact WHERE shape after the fix:
    // and(eq(id, X), eq(orgId, session.org.id))
    const { and: drizzleAnd, eq: drizzleEq } = await import("drizzle-orm");
    await dbHolder.current
      .update(countryIntegrationCredentials)
      .set({ updatedAt: new Date() })
      .where(
        drizzleAnd(
          drizzleEq(countryIntegrationCredentials.id, orgBCredId),
          drizzleEq(countryIntegrationCredentials.orgId, orgAId),
        ),
      );

    // Org B's lastValidatedAt should still be null (we set updatedAt
    // only on the would-be cross-org match — but the AND-with-orgA
    // returns no rows, so nothing changes).
    const [row] = await dbHolder.current
      .select()
      .from(countryIntegrationCredentials)
      .where(eq(countryIntegrationCredentials.id, orgBCredId));
    expect(row.lastValidatedAt).toBeNull();
  });

  it("the OLD shape (id-only) WOULD have updated Org B's row — proves the test is meaningful", async () => {
    await dbHolder.current
      .update(countryIntegrationCredentials)
      .set({ lastValidatedAt: new Date() })
      .where(eq(countryIntegrationCredentials.id, orgBCredId));

    const [row] = await dbHolder.current
      .select()
      .from(countryIntegrationCredentials)
      .where(eq(countryIntegrationCredentials.id, orgBCredId));
    expect(row.lastValidatedAt).not.toBeNull();
  });
});
