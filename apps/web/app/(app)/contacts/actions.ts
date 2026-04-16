"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { contacts } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { detectCountryFromTaxId } from "@/lib/utils";
import { getCountryProvider } from "@/lib/country";
import { lookupGreekAfm } from "@/lib/country/services/aade";
import { validateViesVat } from "@/lib/country/services/vies";
import type { CompanyLookupResult } from "@/lib/country";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("contacts");

const contactSchema = z.object({
  type: z.enum(["client", "supplier", "both"]),
  classification: z.enum(["individual", "business", "government"]),
  company: z.string().max(255).optional().default(""),
  firstName: z.string().max(255).optional().default(""),
  lastName: z.string().max(255).optional().default(""),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional().default(""),
  vatNumber: z.string().max(50).optional().default(""),
  countryCode: z.string().max(2).optional().default(""),
  taxOffice: z.string().max(255).optional().default(""),
  addressLine1: z.string().max(255).optional().default(""),
  addressLine2: z.string().max(255).optional().default(""),
  city: z.string().max(100).optional().default(""),
  postalCode: z.string().max(20).optional().default(""),
  region: z.string().max(100).optional().default(""),
  defaultCurrency: z.string().max(3).optional().default(""),
  defaultLanguage: z.string().max(5).optional().default(""),
  defaultPaymentTerms: z.coerce.number().int().min(0).max(365).optional(),
  notes: z.string().optional().default(""),
});

function computeDisplayName(
  company: string,
  firstName: string,
  lastName: string,
): string {
  if (company) return company;
  return [firstName, lastName].filter(Boolean).join(" ") || "Unnamed Contact";
}

export async function createContact(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  log.info("contact creation started", { orgId });

  const parsed = contactSchema.safeParse({
    type: formData.get("type"),
    classification: formData.get("classification"),
    company: formData.get("company") ?? "",
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    vatNumber: formData.get("vatNumber") ?? "",
    countryCode: formData.get("countryCode") ?? "",
    taxOffice: formData.get("taxOffice") ?? "",
    addressLine1: formData.get("addressLine1") ?? "",
    addressLine2: formData.get("addressLine2") ?? "",
    city: formData.get("city") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    region: formData.get("region") ?? "",
    defaultCurrency: formData.get("defaultCurrency") ?? "",
    defaultLanguage: formData.get("defaultLanguage") ?? "",
    defaultPaymentTerms: formData.get("defaultPaymentTerms") || undefined,
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    log.warn("contact validation failed", { orgId });
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  if (!data.company && !data.firstName && !data.lastName) {
    return {
      success: false,
      error: {
        company: [
          "At least one of company, first name, or last name is required",
        ],
      },
    };
  }

  const displayName = computeDisplayName(
    data.company,
    data.firstName,
    data.lastName,
  );

  const detectedCountry = data.vatNumber
    ? detectCountryFromTaxId(data.vatNumber)
    : null;

  const [contact] = await db
    .insert(contacts)
    .values({
      orgId: session.org.id,
      type: data.type,
      classification: data.classification,
      company: data.company || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      displayName,
      email: data.email || null,
      phone: data.phone || null,
      vatNumber: data.vatNumber || null,
      countryCode: detectedCountry || data.countryCode || null,
      taxOffice: data.taxOffice || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      postalCode: data.postalCode || null,
      region: data.region || null,
      defaultCurrency: data.defaultCurrency || null,
      defaultLanguage: data.defaultLanguage || null,
      defaultPaymentTerms: data.defaultPaymentTerms ?? null,
      notes: data.notes || null,
    })
    .returning();

  log.info("contact created", {
    orgId,
    contactId: contact.id,
    type: data.type,
    classification: data.classification,
  });

  revalidatePath("/contacts");
  return { success: true, contact };
}

export async function updateContact(id: string, formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;
  log.info("contact update started", { orgId, contactId: id });

  const parsed = contactSchema.safeParse({
    type: formData.get("type"),
    classification: formData.get("classification"),
    company: formData.get("company") ?? "",
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    vatNumber: formData.get("vatNumber") ?? "",
    countryCode: formData.get("countryCode") ?? "",
    taxOffice: formData.get("taxOffice") ?? "",
    addressLine1: formData.get("addressLine1") ?? "",
    addressLine2: formData.get("addressLine2") ?? "",
    city: formData.get("city") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    region: formData.get("region") ?? "",
    defaultCurrency: formData.get("defaultCurrency") ?? "",
    defaultLanguage: formData.get("defaultLanguage") ?? "",
    defaultPaymentTerms: formData.get("defaultPaymentTerms") || undefined,
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    log.warn("contact update validation failed", { orgId, contactId: id });
    return { success: false, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const displayName = computeDisplayName(
    data.company,
    data.firstName,
    data.lastName,
  );

  const detectedCountry = data.vatNumber
    ? detectCountryFromTaxId(data.vatNumber)
    : null;

  await db
    .update(contacts)
    .set({
      type: data.type,
      classification: data.classification,
      company: data.company || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      displayName,
      email: data.email || null,
      phone: data.phone || null,
      vatNumber: data.vatNumber || null,
      countryCode: detectedCountry || data.countryCode || null,
      taxOffice: data.taxOffice || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      postalCode: data.postalCode || null,
      region: data.region || null,
      defaultCurrency: data.defaultCurrency || null,
      defaultLanguage: data.defaultLanguage || null,
      defaultPaymentTerms: data.defaultPaymentTerms ?? null,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, id), eq(contacts.orgId, session.org.id)));

  log.info("contact updated", { orgId, contactId: id });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return { success: true };
}

export async function deleteContact(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.org.id;

  await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, session.org.id)));

  log.info("contact deleted", { orgId, contactId: id });

  revalidatePath("/contacts");
  return { success: true };
}

export async function lookupVat(vatNumber: string): Promise<{
  success: boolean;
  data?: CompanyLookupResult;
  validated?: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const cleaned = vatNumber.trim().replace(/\s/g, "");
  if (!cleaned) return { success: false, error: "VAT number is required" };

  const detectedCountry = detectCountryFromTaxId(cleaned);
  log.info("VAT lookup started", {
    orgId: session.org.id,
    detectedCountry: detectedCountry ?? "unknown",
  });

  if (detectedCountry === "GR") {
    const done = log.time("vat-lookup-gr");
    const result = await lookupGreekAfm(cleaned);
    if (result) {
      done("Greek AFM lookup succeeded");
      return { success: true, data: result, validated: true };
    }
    done("Greek AFM lookup failed");
    return { success: false, error: "Could not find company with this ΑΦΜ" };
  }

  if (detectedCountry && /^[A-Z]{2}/.test(cleaned)) {
    const done = log.time("vat-lookup-vies");
    const result = await validateViesVat(cleaned);
    if (result.valid && result.company) {
      done("VIES lookup succeeded", { country: detectedCountry });
      return { success: true, data: result.company, validated: true };
    }
    done("VIES lookup failed", { country: detectedCountry });
    return {
      success: false,
      error: result.valid
        ? "VAT number is valid but no company details available"
        : "Invalid EU VAT number",
    };
  }

  log.warn("unsupported VAT format", { orgId: session.org.id });
  return { success: false, error: "Unsupported VAT number format" };
}
