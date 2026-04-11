"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createDb, organisations } from "@opentab/db";
import { eq } from "drizzle-orm";
import { detectCountryFromTaxId } from "@/lib/utils";

const db = createDb(process.env.DATABASE_URL!);

export async function updateCompanySettings(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const defaultCurrency = formData.get("defaultCurrency") as string;
  const fiscalYearStart = parseInt(formData.get("fiscalYearStart") as string);
  const taxId = formData.get("taxId") as string;
  const taxAuthority = formData.get("taxAuthority") as string;
  const addressLine1 = formData.get("addressLine1") as string;
  const addressLine2 = formData.get("addressLine2") as string;
  const city = formData.get("city") as string;
  const postalCode = formData.get("postalCode") as string;
  const region = formData.get("region") as string;
  const phone = formData.get("phone") as string;
  const countryManual = formData.get("country") as string;

  const detectedCountry = taxId ? detectCountryFromTaxId(taxId) : null;
  const countryCode = detectedCountry || countryManual || null;

  const completedSteps: string[] = [];
  if (name && name !== `${session.user.name}'s Company`) {
    completedSteps.push("company_info");
  }
  if (taxId) {
    completedSteps.push("vat_number");
  }

  await db
    .update(organisations)
    .set({
      name,
      defaultCurrency,
      fiscalYearStart,
      taxId: taxId || null,
      taxAuthority: taxAuthority || null,
      countryCode,
      addressLine1: addressLine1 || null,
      addressLine2: addressLine2 || null,
      city: city || null,
      postalCode: postalCode || null,
      region: region || null,
      phone: phone || null,
      setupCompletedSteps: completedSteps,
      updatedAt: new Date(),
    })
    .where(eq(organisations.id, session.org.id));

  revalidatePath("/dashboard");
  revalidatePath("/settings/company");
  return { success: true };
}
