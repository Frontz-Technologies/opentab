import { z } from "zod";
import { contacts } from "@opentab/db/schema";

export { contacts };

export const createContactSchema = z.object({
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
  arGemi: z.string().max(20).optional().or(z.literal("")),
});

export const updateContactSchema = createContactSchema;

export type ContactCreateInput = z.infer<typeof createContactSchema>;
export type ContactUpdateInput = z.infer<typeof updateContactSchema>;
