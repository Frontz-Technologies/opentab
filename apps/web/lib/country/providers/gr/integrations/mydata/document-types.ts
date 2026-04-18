import type { MyDataDocumentType, DocumentTypeParams } from "./types";

export const MYDATA_DOCUMENT_TYPES: Record<string, MyDataDocumentType> = {
  "1.1": {
    code: "1.1",
    name: "Τιμολόγιο Πώλησης",
    nameEn: "Sales Invoice",
    category: "income",
  },
  "1.2": {
    code: "1.2",
    name: "Τιμολόγιο Πώλησης / Ενδοκοινοτικές",
    nameEn: "Sales Invoice / Intra-Community",
    category: "income",
  },
  "1.3": {
    code: "1.3",
    name: "Τιμολόγιο Πώλησης / Τρίτες Χώρες",
    nameEn: "Sales Invoice / Third Countries",
    category: "income",
  },
  "2.1": {
    code: "2.1",
    name: "Τιμολόγιο Παροχής Υπηρεσιών",
    nameEn: "Service Invoice",
    category: "income",
  },
  "2.2": {
    code: "2.2",
    name: "Τιμολόγιο Παροχής / Ενδοκοινοτικές",
    nameEn: "Service Invoice / Intra-Community",
    category: "income",
  },
  "2.3": {
    code: "2.3",
    name: "Τιμολόγιο Παροχής / Τρίτες Χώρες",
    nameEn: "Service Invoice / Third Countries",
    category: "income",
  },
  "5.1": {
    code: "5.1",
    name: "Πιστωτικό Τιμολόγιο Συσχετιζόμενο",
    nameEn: "Associated Credit Invoice",
    category: "credit",
  },
  "5.2": {
    code: "5.2",
    name: "Πιστωτικό Τιμολόγιο Μη Συσχετιζόμενο",
    nameEn: "Non-Associated Credit Invoice",
    category: "credit",
  },
  "11.1": {
    code: "11.1",
    name: "ΑΛΠ",
    nameEn: "Retail Sales Receipt",
    category: "income",
  },
  "11.2": {
    code: "11.2",
    name: "ΑΠΥ",
    nameEn: "Service Rendered Receipt",
    category: "income",
  },
  "11.4": {
    code: "11.4",
    name: "Πιστωτικό Στοιχείο Λιανικής",
    nameEn: "Retail Credit Note",
    category: "credit",
  },
} as const;

const EU_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

export function resolveDocumentType(params: DocumentTypeParams): string {
  const { contactCountryCode, contactVatNumber, isService, isCreditNote } =
    params;

  if (isCreditNote) {
    return params.relatedInvoiceId ? "5.1" : "5.2";
  }

  const isB2C = !contactVatNumber;
  const isGreek = contactCountryCode === "GR" || !contactCountryCode;
  const isEU =
    contactCountryCode !== null &&
    contactCountryCode !== "GR" &&
    EU_COUNTRY_CODES.has(contactCountryCode);

  if (isB2C) {
    return isService ? "11.2" : "11.1";
  }

  if (isGreek) {
    return isService ? "2.1" : "1.1";
  }

  if (isEU) {
    return isService ? "2.2" : "1.2";
  }

  // Third country
  return isService ? "2.3" : "1.3";
}
