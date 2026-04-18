import type { MyDataClassification, MyDataPaymentMethod } from "./types";

export const MYDATA_INCOME_CLASSIFICATIONS: Record<
  string,
  MyDataClassification
> = {
  category1_1: {
    code: "category1_1",
    name: "Έσοδα από πώληση εμπορευμάτων",
    nameEn: "Revenue from sale of goods",
  },
  category1_2: {
    code: "category1_2",
    name: "Έσοδα από πώληση προϊόντων",
    nameEn: "Revenue from sale of products",
  },
  category1_3: {
    code: "category1_3",
    name: "Έσοδα από παροχή υπηρεσιών",
    nameEn: "Revenue from services rendered",
  },
  category1_7: {
    code: "category1_7",
    name: "Λοιπά τρέχοντα έσοδα",
    nameEn: "Other current revenue",
  },
};

export const MYDATA_INCOME_TYPES: Record<string, MyDataClassification> = {
  E3_561_001: {
    code: "E3_561_001",
    name: "Πωλήσεις αγαθών & υπηρεσιών - Χονδρική",
    nameEn: "Sales of goods & services - Wholesale",
  },
  E3_561_002: {
    code: "E3_561_002",
    name: "Πωλήσεις αγαθών & υπηρεσιών - Λιανική",
    nameEn: "Sales of goods & services - Retail",
  },
  E3_561_003: {
    code: "E3_561_003",
    name: "Πωλήσεις αγαθών & υπηρεσιών - Ενδοκοινοτικές",
    nameEn: "Sales of goods & services - Intra-Community",
  },
  E3_561_004: {
    code: "E3_561_004",
    name: "Πωλήσεις αγαθών & υπηρεσιών - Τρίτες χώρες",
    nameEn: "Sales of goods & services - Third Countries",
  },
  E3_561_007: {
    code: "E3_561_007",
    name: "Πωλήσεις αγαθών & υπηρεσιών - Λοιπά",
    nameEn: "Sales of goods & services - Other",
  },
};

export const MYDATA_EXPENSE_CLASSIFICATIONS: Record<
  string,
  MyDataClassification
> = {
  category2_1: {
    code: "category2_1",
    name: "Αγορές εμπορευμάτων",
    nameEn: "Purchase of goods",
  },
  category2_2: {
    code: "category2_2",
    name: "Αγορές πρώτων υλών",
    nameEn: "Purchase of raw materials",
  },
  category2_3: {
    code: "category2_3",
    name: "Λήψη υπηρεσιών",
    nameEn: "Receipt of services",
  },
  category2_4: {
    code: "category2_4",
    name: "Γενικά έξοδα",
    nameEn: "General expenses",
  },
  category2_5: {
    code: "category2_5",
    name: "Μισθοδοσία",
    nameEn: "Payroll",
  },
  category2_7: {
    code: "category2_7",
    name: "Αποσβέσεις",
    nameEn: "Depreciation",
  },
  category2_10: {
    code: "category2_10",
    name: "Λοιπά έξοδα",
    nameEn: "Other expenses",
  },
  category2_11: {
    code: "category2_11",
    name: "Αγορές παγίων",
    nameEn: "Purchase of fixed assets",
  },
};

export const MYDATA_CLASSIFICATION_MATRIX: Record<
  string,
  Record<string, string[]>
> = {
  "1.1": {
    category1_1: ["E3_561_001"],
    category1_3: ["E3_561_001"],
  },
  "1.2": {
    category1_1: ["E3_561_003"],
    category1_3: ["E3_561_003"],
  },
  "1.3": {
    category1_1: ["E3_561_004"],
    category1_3: ["E3_561_004"],
  },
  "2.1": { category1_3: ["E3_561_001"] },
  "2.2": { category1_3: ["E3_561_003"] },
  "2.3": { category1_3: ["E3_561_004"] },
  "11.1": { category1_1: ["E3_561_002"] },
  "11.2": { category1_3: ["E3_561_002"] },
};

export const MYDATA_PAYMENT_METHODS: Record<number, MyDataPaymentMethod> = {
  1: {
    code: 1,
    name: "Επαγγελματικός λογαριασμός",
    nameEn: "Domestic payment",
  },
  2: {
    code: 2,
    name: "Επαγγελματικός λογαριασμός (αλλοδαπή)",
    nameEn: "Foreign payment",
  },
  3: { code: 3, name: "Μετρητά", nameEn: "Cash" },
  4: { code: 4, name: "Επιταγή", nameEn: "Check" },
  5: { code: 5, name: "Πίστωση", nameEn: "On credit" },
  6: { code: 6, name: "Web Banking", nameEn: "Web Banking" },
  7: { code: 7, name: "POS / e-POS", nameEn: "POS / e-POS" },
};

export const MYDATA_VAT_CATEGORIES: Record<
  number,
  { category: number; label: string }
> = {
  24: { category: 1, label: "Standard 24%" },
  13: { category: 2, label: "Reduced 13%" },
  6: { category: 3, label: "Super-reduced 6%" },
  17: { category: 4, label: "Island Standard 17%" },
  9: { category: 5, label: "Island Reduced 9%" },
  4: { category: 6, label: "Island Super-reduced 4%" },
  0: { category: 7, label: "Exempt 0%" },
};

export function resolveClassification(
  documentType: string,
  isService: boolean,
): { category: string; type: string } {
  const matrix = MYDATA_CLASSIFICATION_MATRIX[documentType];
  if (!matrix) {
    return { category: "category1_3", type: "E3_561_001" };
  }

  // Prefer service category for services, goods for goods
  const preferredCategory = isService ? "category1_3" : "category1_1";

  if (matrix[preferredCategory]) {
    return {
      category: preferredCategory,
      type: matrix[preferredCategory][0],
    };
  }

  // Fallback to first available
  const firstCategory = Object.keys(matrix)[0];
  return {
    category: firstCategory,
    type: matrix[firstCategory][0],
  };
}
