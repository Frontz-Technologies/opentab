import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDatabase } from "../test-utils";
import { organisations, aiSettings } from "../schema/index";

describe("AiSettings", () => {
  let db: TestDatabase;
  let teardown: () => Promise<void>;

  beforeAll(async () => {
    const result = await createTestDb();
    db = result.db;
    teardown = result.teardown;
  });

  afterAll(async () => {
    await teardown();
  });

  it("stores one row per organisation with defaults", async () => {
    const [org] = await db
      .insert(organisations)
      .values({ name: "OpenTab", slug: "opentab-ai-settings" })
      .returning();

    await db.insert(aiSettings).values({ orgId: org.id });

    const rows = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.orgId, org.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.enabled).toBe(false);
    // Per-feature model columns are nullable with no default — env or
    // the AI Settings page populates them. A bare insert leaves them null.
    expect(rows[0]?.chatModel).toBeNull();
    expect(rows[0]?.extractionModel).toBeNull();
  });
});
