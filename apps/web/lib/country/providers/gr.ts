import type { CountryProvider, TaxOffice } from "../types";
import { resolveDocumentType } from "@/lib/mydata/document-types";
import { resolveClassification } from "@/lib/mydata/classification-codes";

const greekTaxOffices: TaxOffice[] = [
  { code: "1101", name: "Α' Αθηνών" },
  { code: "1104", name: "Δ' Αθηνών" },
  { code: "1105", name: "Ε' Αθηνών" },
  { code: "1106", name: "ΣΤ' Αθηνών" },
  { code: "1110", name: "Ι' Αθηνών" },
  { code: "1113", name: "ΙΓ' Αθηνών" },
  { code: "1114", name: "ΙΔ' Αθηνών" },
  { code: "1120", name: "Κ' Αθηνών" },
  { code: "1129", name: "ΦΑΕ Αθηνών" },
  { code: "1131", name: "Α' Πειραιά" },
  { code: "1132", name: "Β' Πειραιά" },
  { code: "1133", name: "Γ' Πειραιά" },
  { code: "1134", name: "Δ' Πειραιά" },
  { code: "1135", name: "Ε' Πειραιά" },
  { code: "1136", name: "ΦΑΕ Πειραιά" },
  { code: "1150", name: "Α' Θεσσαλονίκης" },
  { code: "1151", name: "Β' Θεσσαλονίκης" },
  { code: "1152", name: "Γ' Θεσσαλονίκης" },
  { code: "1153", name: "Δ' Θεσσαλονίκης" },
  { code: "1154", name: "Ε' Θεσσαλονίκης" },
  { code: "1155", name: "ΦΑΕ Θεσσαλονίκης" },
  { code: "1201", name: "Αγίου Νικολάου" },
  { code: "1203", name: "Αλεξανδρούπολης" },
  { code: "1206", name: "Αμαλιάδας" },
  { code: "1210", name: "Άρτας" },
  { code: "1215", name: "Βέροιας" },
  { code: "1216", name: "Βόλου" },
  { code: "1220", name: "Δράμας" },
  { code: "1223", name: "Ζακύνθου" },
  { code: "1225", name: "Ηρακλείου" },
  { code: "1228", name: "Θηβών" },
  { code: "1230", name: "Ιωαννίνων" },
  { code: "1232", name: "Καβάλας" },
  { code: "1234", name: "Καλαμάτας" },
  { code: "1236", name: "Καρδίτσας" },
  { code: "1238", name: "Καστοριάς" },
  { code: "1240", name: "Κατερίνης" },
  { code: "1242", name: "Κέρκυρας" },
  { code: "1244", name: "Κιλκίς" },
  { code: "1246", name: "Κοζάνης" },
  { code: "1248", name: "Κομοτηνής" },
  { code: "1250", name: "Κορίνθου" },
  { code: "1254", name: "Λαμίας" },
  { code: "1256", name: "Λάρισας" },
  { code: "1258", name: "Λευκάδας" },
  { code: "1262", name: "Μυτιλήνης" },
  { code: "1265", name: "Ξάνθης" },
  { code: "1268", name: "Πατρών" },
  { code: "1272", name: "Πύργου" },
  { code: "1274", name: "Ρεθύμνου" },
  { code: "1276", name: "Ρόδου" },
  { code: "1278", name: "Σάμου" },
  { code: "1280", name: "Σερρών" },
  { code: "1285", name: "Τρικάλων" },
  { code: "1287", name: "Τρίπολης" },
  { code: "1290", name: "Χαλκίδας" },
  { code: "1292", name: "Χανίων" },
  { code: "1295", name: "Χίου" },
  { code: "1161", name: "Αγίων Αναργύρων" },
  { code: "1162", name: "Αιγάλεω" },
  { code: "1163", name: "Αμαρουσίου" },
  { code: "1164", name: "Γλυφάδας" },
  { code: "1165", name: "Ελευσίνας" },
  { code: "1167", name: "Κηφισιάς" },
  { code: "1168", name: "Νέας Ιωνίας" },
  { code: "1170", name: "Παλλήνης" },
  { code: "1171", name: "Χαλανδρίου" },
  { code: "1172", name: "Χολαργού" },
];

export const GREEK_INCOME_TAX_BRACKETS_2026 = [
  { min: 0, max: 10000, rate: 0.09 },
  { min: 10001, max: 20000, rate: 0.2 },
  { min: 20001, max: 30000, rate: 0.26 },
  { min: 30001, max: 40000, rate: 0.34 },
  { min: 40001, max: 60000, rate: 0.39 },
  { min: 60001, max: Infinity, rate: 0.44 },
];

export const GREEK_CORPORATE_TAX = {
  corporateRate: 0.22,
  dividendRate: 0.05,
  prepaymentRate: 0.55,
  prepaymentFirstYear: 0.5,
};

export const GREEK_EFKA_2026 = {
  selfEmployed: {
    categories: [
      { level: 1, monthly: 220.08, label: "Κατηγορία 1 (ελάχιστη)" },
      { level: 2, monthly: 275.1, label: "Κατηγορία 2" },
      { level: 3, monthly: 343.88, label: "Κατηγορία 3" },
      { level: 4, monthly: 412.65, label: "Κατηγορία 4" },
      { level: 5, monthly: 515.82, label: "Κατηγορία 5" },
      { level: 6, monthly: 644.77, label: "Κατηγορία 6 (μέγιστη)" },
    ],
    defaultCategory: 1,
  },
  employed: {
    employerRate: 0.2179,
    employeeRate: 0.1387,
    monthlyCap: 7761.14,
  },
};

export const greeceProvider: CountryProvider = {
  code: "GR",
  name: "Greece",

  capabilities: {
    companyLookup: true,
    taxOfficeList: true,
    eInvoicing: true,
    taxProjection: false,
    vatReport: false,
    expenseClassification: true,
  },

  vatRates: [
    { rate: 24, label: "Standard (24%)", isDefault: true },
    { rate: 13, label: "Reduced (13%)", isDefault: false },
    { rate: 6, label: "Super-reduced (6%)", isDefault: false },
    { rate: 0, label: "Exempt (0%)", isDefault: false },
  ],

  taxOffices: greekTaxOffices,

  validateTaxId(taxId: string): boolean {
    const cleaned = taxId.replace(/\s/g, "");
    return /^\d{9}$/.test(cleaned);
  },

  getDefaultVatRate(): number {
    return 24;
  },

  resolveDocumentType,
  resolveClassification,

  incomeTaxBrackets: GREEK_INCOME_TAX_BRACKETS_2026,
  corporateTax: GREEK_CORPORATE_TAX,
  socialSecurity: GREEK_EFKA_2026,
};
