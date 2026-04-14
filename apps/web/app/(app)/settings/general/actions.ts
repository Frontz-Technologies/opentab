"use server";

import { upsertUserPreferences } from "@/lib/actions/user-preferences";
import { revalidatePath } from "next/cache";

export async function updateGeneralSettings(formData: FormData) {
  await upsertUserPreferences({
    locale: formData.get("locale") as string,
    dateFormat: formData.get("dateFormat") as string,
    numberFormat: formData.get("numberFormat") as string,
    notifyInvoicePaid: formData.get("notifyInvoicePaid") === "on",
    notifyExpenseApproved: formData.get("notifyExpenseApproved") === "on",
  });

  revalidatePath("/settings/general");
}
