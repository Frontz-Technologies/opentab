"use server";

import { revalidatePath } from "next/cache";
import { upsertUserPreferences } from "@/lib/actions/user-preferences";

export async function updateAppearanceSettings(formData: FormData) {
  const theme = formData.get("theme") as string;
  const density = formData.get("density") as string;

  await upsertUserPreferences({
    theme: theme || "dark",
    density: density || "comfortable",
  });

  revalidatePath("/settings/appearance");
}
