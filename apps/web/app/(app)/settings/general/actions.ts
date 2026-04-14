"use server";

import { cookies } from "next/headers";
import { upsertUserPreferences } from "@/lib/actions/user-preferences";
import { revalidatePath } from "next/cache";

export async function updateGeneralSettings(formData: FormData) {
  const locale = formData.get("locale") as string;

  await upsertUserPreferences({
    locale,
    dateFormat: formData.get("dateFormat") as string,
    numberFormat: formData.get("numberFormat") as string,
    notifyInvoicePaid: formData.get("notifyInvoicePaid") === "on",
    notifyExpenseApproved: formData.get("notifyExpenseApproved") === "on",
  });

  // Set locale cookie for next-intl to read
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/");
}
