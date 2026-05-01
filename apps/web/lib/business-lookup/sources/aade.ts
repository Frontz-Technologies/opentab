import { lookupGreekAfm } from "@/lib/country/providers/gr/integrations/mydata/services/aade";
import type { CompanyLookupSource } from "../source";

export const aadeSource: CompanyLookupSource = {
  id: "aade",
  displayName: "ΑΑΔΕ (Greek tax authority)",
  priority: 10,

  supports(countryCode: string): boolean {
    return countryCode === "GR";
  },

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async lookup(taxId: string) {
    return lookupGreekAfm(taxId);
  },
};
