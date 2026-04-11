import { headers } from "next/headers";
import { auth } from "./auth-server";
import { createDb } from "@opentab/db";
import { orgMemberships, organisations } from "@opentab/db/schema";
import { eq } from "drizzle-orm";

export type SessionContext = {
  user: { id: string; name: string; email: string; locale: string };
  org: {
    id: string;
    name: string;
    slug: string;
    countryCode: string | null;
    defaultCurrency: string;
    setupCompletedSteps: string[];
  };
  role: "owner" | "admin" | "member" | "accountant";
};

const db = createDb(process.env.DATABASE_URL!);

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
      setupCompletedSteps: (org.setupCompletedSteps as string[]) || [],
    },
    role: membership.role as SessionContext["role"],
  };
}
