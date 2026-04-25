import { z } from "zod";
import type { ImporterDescriptor } from "../core/types";

// `displayName` is notNull at the DB level (verified against
// packages/db/src/schema/contacts.ts on the import-spec audit). The
// schema below derives it from whichever name field the user supplied
// so the user never has to provide it explicitly.
export const contactRowSchema = z
  .object({
    company: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    firstName: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    lastName: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    email: z
      .string()
      .email()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    phone: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    vatNumber: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    countryCode: z
      .string()
      .length(2)
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    addressLine1: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    city: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    postalCode: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => v || undefined),
    type: z.enum(["client", "supplier", "both"]).optional().default("client"),
    classification: z
      .enum(["individual", "business", "government"])
      .optional(),
    defaultPaymentTerms: z.coerce.number().int().min(0).max(365).optional(),
  })
  .refine((d) => !!(d.company || (d.firstName && d.lastName)), {
    message: "must provide either company OR firstName + lastName",
  })
  .transform((d) => ({
    ...d,
    displayName: d.company ?? `${d.firstName} ${d.lastName}`,
    classification:
      d.classification ?? (d.vatNumber ? "business" : "individual"),
    defaultPaymentTerms: d.defaultPaymentTerms ?? 30,
  }));

type ContactRow = z.infer<typeof contactRowSchema>;

export const contactsImporter: ImporterDescriptor<ContactRow> = {
  entityKey: "contacts",
  label: "Contacts",
  fields: [
    { name: "company", required: false, type: "string" },
    { name: "firstName", required: false, type: "string" },
    { name: "lastName", required: false, type: "string" },
    { name: "email", required: false, type: "string" },
    { name: "phone", required: false, type: "string" },
    { name: "vatNumber", required: false, type: "string" },
    { name: "countryCode", required: false, type: "string" },
    { name: "addressLine1", required: false, type: "string" },
    { name: "city", required: false, type: "string" },
    { name: "postalCode", required: false, type: "string" },
    {
      name: "type",
      required: false,
      type: "enum",
      enum: ["client", "supplier", "both"],
    },
    {
      name: "classification",
      required: false,
      type: "enum",
      enum: ["individual", "business", "government"],
    },
    { name: "defaultPaymentTerms", required: false, type: "number" },
  ],
  aliases: {
    company: ["company", "company name", "name", "business name", "client name"],
    firstName: ["first name", "first_name", "firstname", "given name"],
    lastName: ["last name", "last_name", "lastname", "surname", "family name"],
    email: ["email", "e-mail", "e mail", "correo", "email address"],
    phone: ["phone", "phone number", "telephone", "mobile", "tel"],
    vatNumber: ["vat", "vat #", "vat number", "afm", "tax id", "vat id"],
    countryCode: ["country", "country code", "country_code"],
    addressLine1: ["address", "address 1", "address_line_1", "street"],
    city: ["city", "town"],
    postalCode: ["zip", "postal code", "postcode", "zip code"],
    type: ["type"],
    classification: ["classification", "kind"],
    defaultPaymentTerms: ["payment terms", "payment_terms", "net days"],
  },
  rowSchema: contactRowSchema as unknown as ImporterDescriptor<ContactRow>["rowSchema"],
  idempotencyKeyParts: (row, orgId) => [
    orgId,
    (row.vatNumber ?? row.email ?? row.displayName).toLowerCase(),
  ],
};
