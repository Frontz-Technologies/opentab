"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  contacts,
  createContactSchema,
  updateContactSchema,
} from "@/lib/entities/contact";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { z } from "zod";
import { detectCountryFromTaxId } from "@/lib/utils";
import { lookupCompany } from "@/lib/business-lookup/orchestrator";
import type { CompanyLookupResult } from "@/lib/business-lookup/source";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("contacts");

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

  const parsed = createContactSchema.safeParse({
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
    arGemi: formData.get("arGemi") ?? "",
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
      arGemi: data.arGemi || null,
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

  const parsed = updateContactSchema.safeParse({
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
    arGemi: formData.get("arGemi") ?? "",
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
      arGemi: data.arGemi || null,
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
  sourceUsed?: string;
  error?: string;
}> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const cleaned = vatNumber.trim().replace(/\s/g, "");
  if (!cleaned) return { success: false, error: "VAT number is required" };

  const { result, sourceUsed } = await lookupCompany(cleaned, session.org.id);
  if (!result) {
    return { success: false, error: "No business found for this tax ID" };
  }
  return { success: true, data: result, sourceUsed: sourceUsed ?? undefined };
}
