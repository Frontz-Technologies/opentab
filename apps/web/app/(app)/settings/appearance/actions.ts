"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { upsertUserPreferences } from "@/lib/actions/user-preferences";
import { THEME_COOKIE_NAME } from "@/lib/theme";

export async function updateAppearanceSettings(formData: FormData) {
  const theme = formData.get("theme") as string;
  const density = formData.get("density") as string;
  const resolvedTheme = theme || "dark";

  await upsertUserPreferences({
    theme: resolvedTheme,
    density: density || "comfortable",
  });

  // Echo the preference into a cookie so the pre-hydration inline script
  // picks it up without waiting for the DB round-trip on subsequent loads.
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE_NAME, resolvedTheme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/settings/appearance");
}
