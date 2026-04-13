"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { organisations } from "@opentab/db";
import { eq } from "drizzle-orm";
import { detectCountryFromTaxId } from "@/lib/utils";
import { db } from "@/lib/db";
import { z } from "zod";

const companySettingsSchema = z.object({
  name: z.string().min(1).max(255),
  defaultCurrency: z.enum([
    "EUR",
    "USD",
    "GBP",
    "CHF",
    "SEK",
    "DKK",
    "NOK",
    "PLN",
    "CZK",
    "HUF",
    "RON",
    "BGN",
  ]),
  fiscalYearStart: z.coerce.number().int().min(1).max(12),
  taxId: z.string().max(50).optional().default(""),
  taxAuthority: z.string().max(255).optional().default(""),
  country: z.string().max(2).optional().default(""),
  addressLine1: z.string().max(255).optional().default(""),
  addressLine2: z.string().max(255).optional().default(""),
  city: z.string().max(100).optional().default(""),
  postalCode: z.string().max(20).optional().default(""),
  region: z.string().max(100).optional().default(""),
  phone: z.string().max(50).optional().default(""),
});

export async function updateCompanySettings(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (session.role !== "owner" && session.role !== "admin") {
    throw new Error("Forbidden");
  }

  const parsed = companySettingsSchema.safeParse({
    name: formData.get("name"),
    defaultCurrency: formData.get("defaultCurrency"),
    fiscalYearStart: formData.get("fiscalYearStart"),
    taxId: formData.get("taxId"),
    taxAuthority: formData.get("taxAuthority"),
    country: formData.get("country"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    postalCode: formData.get("postalCode"),
    region: formData.get("region"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const {
    name,
    defaultCurrency,
    fiscalYearStart,
    taxId,
    taxAuthority,
    country: countryManual,
    addressLine1,
    addressLine2,
    city,
    postalCode,
    region,
    phone,
  } = parsed.data;

  const detectedCountry = taxId ? detectCountryFromTaxId(taxId) : null;
  const countryCode = detectedCountry || countryManual || null;

  const existingSteps = session.org.setupCompletedSteps || [];
  const newSteps = new Set(existingSteps);
  if (name && name !== `${session.user.name}'s Company`) {
    newSteps.add("company_info");
  }
  if (taxId) {
    newSteps.add("vat_number");
  }
  const completedSteps = Array.from(newSteps);

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

const taxSettingsSchema = z.object({
  entityType: z.enum(["freelancer", "ike", "epe", "ae"]).optional(),
  efkaCategory: z.number().int().min(1).max(6).optional(),
  ownerBirthDate: z.string().date().optional(),
  isFirstYear: z.boolean().optional(),
});

export async function updateOrgTaxSettings(
  settings: z.infer<typeof taxSettingsSchema>,
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (session.role !== "owner" && session.role !== "admin") {
    throw new Error("Forbidden");
  }

  const parsed = taxSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  await db
    .update(organisations)
    .set({
      taxSettings: parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(organisations.id, session.org.id));

  revalidatePath("/reports/tax-projection");
  revalidatePath("/settings/company");
  return { success: true };
}
