CREATE TYPE "expense_group_type" AS ENUM ('operating_expense', 'purchase', 'asset', 'other');

ALTER TABLE "expense_group" ADD COLUMN "type" "expense_group_type" DEFAULT 'operating_expense' NOT NULL;
ALTER TABLE "expense_group" ADD COLUMN "type_color" varchar(7);

-- Re-seed: overwrite the system-wide group types for the 16 existing groups + add the 4 new groups.
UPDATE "expense_group" SET "type" = 'other' WHERE "code" IN ('taxes_contributions', 'other');
UPDATE "expense_group" SET "type" = 'operating_expense' WHERE "code" IN ('rent', 'utilities', 'telecom', 'office_supplies', 'software', 'hardware', 'professional_services', 'marketing', 'travel', 'transport', 'insurance', 'meals_entertainment', 'bank_fees', 'training');

INSERT INTO "expense_group" ("code", "name_en", "name_es", "name_el", "name_de", "sort_order", "type") VALUES
  ('salaries', 'Salaries', 'Salarios', 'Μισθοί', 'Gehälter', 17, 'operating_expense'),
  ('employee_benefits', 'Employee Benefits', 'Beneficios para empleados', 'Παροχές εργαζομένων', 'Mitarbeiter-Leistungen', 18, 'operating_expense'),
  ('repairs_maintenance', 'Repairs & Maintenance', 'Reparaciones y mantenimiento', 'Επισκευή & συντήρηση', 'Reparatur & Wartung', 19, 'operating_expense'),
  ('purchases', 'Purchases & Inventory', 'Compras e inventario', 'Αγορές & απόθεμα', 'Einkäufe & Lager', 20, 'purchase')
ON CONFLICT ("code") DO NOTHING;
