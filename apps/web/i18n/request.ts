import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { userPreferences } from "@opentab/db/schema";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

const VALID_LOCALES = ["en", "el", "es"] as const;
type ValidLocale = (typeof VALID_LOCALES)[number];

function isValid(value: unknown): value is ValidLocale {
  return (
    typeof value === "string" &&
    (VALID_LOCALES as readonly string[]).includes(value)
  );
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("locale")?.value;

  let resolved: ValidLocale | undefined = isValid(cookieValue)
    ? cookieValue
    : undefined;

  if (!resolved) {
    const session = await getSession();
    if (session?.user?.id) {
      const rows = await db
        .select({ locale: userPreferences.locale })
        .from(userPreferences)
        .where(eq(userPreferences.userId, session.user.id));
      const dbLocale = rows[0]?.locale;
      if (isValid(dbLocale)) resolved = dbLocale;
    }
  }

  const locale: ValidLocale = resolved ?? "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
