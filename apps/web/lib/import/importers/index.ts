import { contactsImporter } from "./contacts";
import { expensesImporter } from "./expenses";
import { invoicesImporter } from "./invoices";
import type { ImporterDescriptor } from "../core/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IMPORTERS: Record<string, ImporterDescriptor<any>> = {
  contacts: contactsImporter,
  expenses: expensesImporter,
  invoices: invoicesImporter,
};

export function getImporter(entityKey: string) {
  const importer = IMPORTERS[entityKey];
  if (!importer) throw new Error(`unknown importer: ${entityKey}`);
  return importer;
}
