import { validateViesVat } from "@/lib/country/services/vies";
import { EU_COUNTRY_CODES } from "@/lib/country/eu-codes";
import type { CompanyLookupSource } from "../source";

export const viesSource: CompanyLookupSource = {
  id: "vies",
  displayName: "VIES (EU VAT Information Exchange System)",
  priority: 50,

  supports(countryCode: string): boolean {
    return EU_COUNTRY_CODES.has(countryCode);
  },

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async lookup(taxId: string) {
    const result = await validateViesVat(taxId);
    if (!result.valid || !result.company) return null;
    if (!result.company.name) return null;
    return result.company;
  },
};
