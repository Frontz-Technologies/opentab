import { headers } from "next/headers";
import { auth } from "./auth-server";
import { orgMemberships, organisations } from "@opentab/db/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

export type SessionContext = {
  user: { id: string; name: string; email: string; locale: string };
  org: {
    id: string;
    name: string;
    slug: string;
    countryCode: string | null;
    defaultCurrency: string;
    fiscalYearStart: number;
    taxId: string | null;
    taxAuthority: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
    region: string | null;
    phone: string | null;
    email: string | null;
    setupCompletedSteps: string[];
    isDemo: boolean;
  };
  role: "owner" | "admin" | "member" | "accountant";
};

export async function getSession(): Promise<SessionContext | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, session.user.id))
    .limit(1);

  if (!membership) return null;

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, membership.orgId))
    .limit(1);

  if (!org) return null;

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      locale: (session.user as any).locale || "en",
    },
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      countryCode: org.countryCode ?? null,
      defaultCurrency: org.defaultCurrency,
      fiscalYearStart: org.fiscalYearStart,
      taxId: org.taxId ?? null,
      taxAuthority: org.taxAuthority ?? null,
      addressLine1: org.addressLine1 ?? null,
      addressLine2: org.addressLine2 ?? null,
      city: org.city ?? null,
      postalCode: org.postalCode ?? null,
      region: org.region ?? null,
      phone: org.phone ?? null,
      email: org.email ?? null,
      setupCompletedSteps: (org.setupCompletedSteps as string[]) || [],
      isDemo: org.isDemo,
    },
    role: membership.role as SessionContext["role"],
  };
}
