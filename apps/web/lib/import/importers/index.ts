import { contactsImporter } from "./contacts";
import { expensesImporter } from "./expenses";
import { invoicesImporter } from "./invoices";
import { creditNotesImporter } from "./credit-notes";
import type { ImporterDescriptor } from "../core/types";

export const IMPORTERS: Record<string, ImporterDescriptor<any>> = {
  contacts: contactsImporter,
  expenses: expensesImporter,
  invoices: invoicesImporter,
  "credit-notes": creditNotesImporter,
};

export function getImporter(entityKey: string) {
  const importer = IMPORTERS[entityKey];
  if (!importer) throw new Error(`unknown importer: ${entityKey}`);
  return importer;
}
