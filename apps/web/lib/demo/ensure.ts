import { eq } from "drizzle-orm";
import * as schema from "@opentab/db/schema";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth-server";
import { DEMO_USER, DEMO_ORG_GR } from "./data-pool";
import { populateOrgDemo, clearOrgData } from "./populate";

export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_SAMPLE_DATA_ENABLED === "true";
}

// Idempotent: create demo user (via better-auth so its hooks fire and
// the default org + membership exist), stamp the org as the demo org,
// seed business data if not already seeded. Safe to call on every
// login-page render — if the user + populated data exist it is a
// cheap no-op (one select).
export async function ensureDemoAccount(): Promise<{ orgId: string }> {
  if (!isDemoModeEnabled()) {
    throw new Error("DEMO_SAMPLE_DATA_ENABLED is not set");
  }

  // Look up an existing demo user.
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_USER.email))
    .limit(1);

  let userId: string;
  if (existing.length > 0) {
    userId = existing[0].id;
  } else {
    const res = await auth.api.signUpEmail({
      body: {
        email: DEMO_USER.email,
        password: DEMO_USER.password,
        name: DEMO_USER.name,
      },
    });
    userId = res.user.id;
  }

  // Find the user's org (the auth hook created exactly one on sign-up).
  const membership = await db
    .select({ orgId: schema.orgMemberships.orgId })
    .from(schema.orgMemberships)
    .where(eq(schema.orgMemberships.userId, userId))
    .limit(1);
  if (membership.length === 0) {
    throw new Error("Demo user has no org membership — auth hook failed?");
  }
  const orgId = membership[0].orgId;

  // Stamp as demo + fill the narrative org profile if not already done.
  await db
    .update(schema.organisations)
    .set({
      isDemo: true,
      name: DEMO_ORG_GR.name,
      taxId: DEMO_ORG_GR.taxId,
      taxAuthority: DEMO_ORG_GR.taxAuthority,
      countryCode: DEMO_ORG_GR.countryCode,
      defaultCurrency: DEMO_ORG_GR.defaultCurrency,
      addressLine1: DEMO_ORG_GR.addressLine1,
      city: DEMO_ORG_GR.city,
      postalCode: DEMO_ORG_GR.postalCode,
      region: DEMO_ORG_GR.region,
      phone: DEMO_ORG_GR.phone,
    })
    .where(eq(schema.organisations.id, orgId));

  // Populate only if the business tables are empty for this org.
  const invoiceCount = await db
    .select({ id: schema.invoices.id })
    .from(schema.invoices)
    .where(eq(schema.invoices.orgId, orgId))
    .limit(1);
  if (invoiceCount.length === 0) {
    await populateOrgDemo(db, orgId);
  }

  return { orgId };
}

// Wipe and re-populate the demo org in one go — what the "Reset demo"
// button invokes. Only runs when the invoking org is flagged isDemo.
export async function resetDemoOrg(orgId: string): Promise<void> {
  const row = await db
    .select({ isDemo: schema.organisations.isDemo })
    .from(schema.organisations)
    .where(eq(schema.organisations.id, orgId))
    .limit(1);
  if (row.length === 0 || !row[0].isDemo) {
    throw new Error("resetDemoOrg called on a non-demo org");
  }
  await clearOrgData(db, orgId);
  await populateOrgDemo(db, orgId);
}
