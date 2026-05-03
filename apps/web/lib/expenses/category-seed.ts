import { db as defaultDb } from "@/lib/db";
import { expenseCategories } from "@opentab/db/schema";
import { eq, count, sql } from "drizzle-orm";

type Db = typeof defaultDb;

type SeedCategoryData = {
  groupCode: string;
  code: string;
  name: string;
  sortOrder: number;
};

const GR_CATEGORIES: SeedCategoryData[] = [
  {
    groupCode: "rent",
    code: "gr_rent",
    name: "Ενοίκιο γραφείου",
    sortOrder: 1,
  },
  {
    groupCode: "utilities",
    code: "gr_utilities",
    name: "Λογαριασμοί (ΔΕΗ, ύδρευση)",
    sortOrder: 2,
  },
  {
    groupCode: "telecom",
    code: "gr_telecom",
    name: "Τηλεπικοινωνίες",
    sortOrder: 3,
  },
  {
    groupCode: "office_supplies",
    code: "gr_office_supplies",
    name: "Αναλώσιμα γραφείου",
    sortOrder: 4,
  },
  {
    groupCode: "software",
    code: "gr_software",
    name: "Λογισμικό & συνδρομές",
    sortOrder: 5,
  },
  {
    groupCode: "hardware",
    code: "gr_hardware",
    name: "Εξοπλισμός & hardware",
    sortOrder: 6,
  },
  {
    groupCode: "professional_services",
    code: "gr_professional",
    name: "Λογιστικές & νομικές υπηρεσίες",
    sortOrder: 7,
  },
  {
    groupCode: "marketing",
    code: "gr_marketing",
    name: "Διαφήμιση & marketing",
    sortOrder: 8,
  },
  { groupCode: "travel", code: "gr_travel", name: "Ταξίδια", sortOrder: 9 },
  {
    groupCode: "transport",
    code: "gr_transport",
    name: "Μεταφορικά",
    sortOrder: 10,
  },
  {
    groupCode: "insurance",
    code: "gr_insurance",
    name: "Ασφάλιστρα",
    sortOrder: 11,
  },
  {
    groupCode: "meals_entertainment",
    code: "gr_meals",
    name: "Γεύματα & φιλοξενία",
    sortOrder: 12,
  },
  {
    groupCode: "bank_fees",
    code: "gr_bank_fees",
    name: "Τραπεζικά έξοδα",
    sortOrder: 13,
  },
  {
    groupCode: "training",
    code: "gr_training",
    name: "Εκπαίδευση",
    sortOrder: 14,
  },
  {
    groupCode: "taxes_contributions",
    code: "gr_taxes",
    name: "Φόροι & εισφορές",
    sortOrder: 15,
  },
  { groupCode: "other", code: "gr_other", name: "Λοιπά έξοδα", sortOrder: 16 },
  { groupCode: "salaries", code: "gr_salaries", name: "Μισθοί", sortOrder: 17 },
  {
    groupCode: "employee_benefits",
    code: "gr_employee_benefits",
    name: "Παροχές εργαζομένων",
    sortOrder: 18,
  },
  {
    groupCode: "repairs_maintenance",
    code: "gr_repairs",
    name: "Επισκευή & συντήρηση",
    sortOrder: 19,
  },
  {
    groupCode: "purchases",
    code: "gr_purchases",
    name: "Αγορές & απόθεμα",
    sortOrder: 20,
  },
];

const DE_CATEGORIES: SeedCategoryData[] = [
  { groupCode: "rent", code: "de_rent", name: "Büromiete", sortOrder: 1 },
  {
    groupCode: "utilities",
    code: "de_utilities",
    name: "Nebenkosten",
    sortOrder: 2,
  },
  {
    groupCode: "telecom",
    code: "de_telecom",
    name: "Telefon & Internet",
    sortOrder: 3,
  },
  {
    groupCode: "office_supplies",
    code: "de_office_supplies",
    name: "Büromaterial",
    sortOrder: 4,
  },
  {
    groupCode: "software",
    code: "de_software",
    name: "Software & Abos",
    sortOrder: 5,
  },
  {
    groupCode: "hardware",
    code: "de_hardware",
    name: "Hardware & Geräte",
    sortOrder: 6,
  },
  {
    groupCode: "professional_services",
    code: "de_professional",
    name: "Beratung & Buchhaltung",
    sortOrder: 7,
  },
  {
    groupCode: "marketing",
    code: "de_marketing",
    name: "Werbung & Marketing",
    sortOrder: 8,
  },
  { groupCode: "travel", code: "de_travel", name: "Reisekosten", sortOrder: 9 },
  {
    groupCode: "transport",
    code: "de_transport",
    name: "Fahrtkosten",
    sortOrder: 10,
  },
  {
    groupCode: "insurance",
    code: "de_insurance",
    name: "Versicherungen",
    sortOrder: 11,
  },
  {
    groupCode: "meals_entertainment",
    code: "de_meals",
    name: "Bewirtung",
    sortOrder: 12,
  },
  {
    groupCode: "bank_fees",
    code: "de_bank_fees",
    name: "Bankgebühren",
    sortOrder: 13,
  },
  {
    groupCode: "training",
    code: "de_training",
    name: "Fortbildung",
    sortOrder: 14,
  },
  {
    groupCode: "taxes_contributions",
    code: "de_taxes",
    name: "Steuern & Beiträge",
    sortOrder: 15,
  },
  {
    groupCode: "other",
    code: "de_other",
    name: "Sonstige Ausgaben",
    sortOrder: 16,
  },
  {
    groupCode: "salaries",
    code: "de_salaries",
    name: "Gehälter",
    sortOrder: 17,
  },
  {
    groupCode: "employee_benefits",
    code: "de_employee_benefits",
    name: "Mitarbeiter-Leistungen",
    sortOrder: 18,
  },
  {
    groupCode: "repairs_maintenance",
    code: "de_repairs",
    name: "Reparatur & Wartung",
    sortOrder: 19,
  },
  {
    groupCode: "purchases",
    code: "de_purchases",
    name: "Einkäufe & Lager",
    sortOrder: 20,
  },
];

const INTL_CATEGORIES: SeedCategoryData[] = [
  { groupCode: "rent", code: "int_rent", name: "Rent", sortOrder: 1 },
  {
    groupCode: "utilities",
    code: "int_utilities",
    name: "Utilities",
    sortOrder: 2,
  },
  {
    groupCode: "telecom",
    code: "int_telecom",
    name: "Internet & Phone",
    sortOrder: 3,
  },
  {
    groupCode: "office_supplies",
    code: "int_office_supplies",
    name: "Office Supplies",
    sortOrder: 4,
  },
  {
    groupCode: "software",
    code: "int_software",
    name: "Software & Subscriptions",
    sortOrder: 5,
  },
  {
    groupCode: "hardware",
    code: "int_hardware",
    name: "Hardware & Equipment",
    sortOrder: 6,
  },
  {
    groupCode: "professional_services",
    code: "int_professional",
    name: "Professional Services",
    sortOrder: 7,
  },
  {
    groupCode: "marketing",
    code: "int_marketing",
    name: "Marketing & Advertising",
    sortOrder: 8,
  },
  { groupCode: "travel", code: "int_travel", name: "Travel", sortOrder: 9 },
  {
    groupCode: "transport",
    code: "int_transport",
    name: "Transport",
    sortOrder: 10,
  },
  {
    groupCode: "insurance",
    code: "int_insurance",
    name: "Insurance",
    sortOrder: 11,
  },
  {
    groupCode: "meals_entertainment",
    code: "int_meals",
    name: "Meals & Entertainment",
    sortOrder: 12,
  },
  {
    groupCode: "bank_fees",
    code: "int_bank_fees",
    name: "Bank Fees",
    sortOrder: 13,
  },
  {
    groupCode: "training",
    code: "int_training",
    name: "Training & Education",
    sortOrder: 14,
  },
  {
    groupCode: "taxes_contributions",
    code: "int_taxes",
    name: "Taxes & Contributions",
    sortOrder: 15,
  },
  { groupCode: "other", code: "int_other", name: "Other", sortOrder: 16 },
  {
    groupCode: "salaries",
    code: "int_salaries",
    name: "Salaries",
    sortOrder: 17,
  },
  {
    groupCode: "employee_benefits",
    code: "int_employee_benefits",
    name: "Employee Benefits",
    sortOrder: 18,
  },
  {
    groupCode: "repairs_maintenance",
    code: "int_repairs",
    name: "Repairs & Maintenance",
    sortOrder: 19,
  },
  {
    groupCode: "purchases",
    code: "int_purchases",
    name: "Purchases & Inventory",
    sortOrder: 20,
  },
];

const COUNTRY_SEED_MAP: Record<string, SeedCategoryData[]> = {
  GR: GR_CATEGORIES,
  DE: DE_CATEGORIES,
};

export async function seedExpenseCategories(
  orgId: string,
  countryCode: string | null,
  db: Db = defaultDb,
): Promise<void> {
  const [result] = await db
    .select({ value: count() })
    .from(expenseCategories)
    .where(eq(expenseCategories.orgId, orgId));

  if (result.value > 0) return;

  // Ensure expense groups are seeded (system table). Upsert so:
  //   - Any new rows added to EXPENSE_GROUPS_SEED over time get inserted.
  //   - Any row-level changes to type/name/etc. overwrite the existing
  //     row on re-run.
  // A "if groupCount === 0, insert" gate would mean an environment
  // that already had the first-wave 16 groups would never see new
  // groups or `type` values added in later waves.
  const { expenseGroups, EXPENSE_GROUPS_SEED } =
    await import("@opentab/db/schema");
  await db
    .insert(expenseGroups)
    .values(EXPENSE_GROUPS_SEED)
    .onConflictDoUpdate({
      target: expenseGroups.code,
      set: {
        nameEn: sql`excluded.name_en`,
        nameEs: sql`excluded.name_es`,
        nameEl: sql`excluded.name_el`,
        nameDe: sql`excluded.name_de`,
        sortOrder: sql`excluded.sort_order`,
        type: sql`excluded.type`,
        typeColor: sql`excluded.type_color`,
      },
    });

  const seed = COUNTRY_SEED_MAP[countryCode ?? ""] ?? INTL_CATEGORIES;

  await db
    .insert(expenseCategories)
    .values(
      seed.map((cat) => ({
        orgId,
        groupCode: cat.groupCode,
        code: cat.code,
        name: cat.name,
        sortOrder: cat.sortOrder,
        isDefault: true,
      })),
    )
    .onConflictDoNothing({
      target: [expenseCategories.orgId, expenseCategories.code],
    });
}

export async function ensureCategoriesSeeded(
  orgId: string,
  countryCode: string | null,
  db: Db = defaultDb,
): Promise<void> {
  await seedExpenseCategories(orgId, countryCode, db);
}
