import type { CompanyLookupSource } from "../source";

const ENDPOINT = "https://publicity.businessportal.gr/api/autocomplete";
const TIMEOUT_MS = 5000;

interface AutocompleteHit {
  arGemi?: number;
  title?: string;
  co_name?: string;
  afm?: string;
  companyStatus?: string;
}

interface AutocompleteResponse {
  payload?: { autocomplete?: AutocompleteHit[] };
}

export const gemiPublicSource: CompanyLookupSource = {
  id: "gemi-public",
  displayName: "GEMI (public lookup)",
  priority: 5,

  supports(countryCode: string): boolean {
    return countryCode === "GR";
  },

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async lookup(taxId: string) {
    const cleaned = taxId.replace(/\s/g, "");
    try {
      const response = await fetch(`${ENDPOINT}/${cleaned}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: null, language: "el" }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as AutocompleteResponse;
      const hit = data.payload?.autocomplete?.[0];
      if (!hit?.co_name) return null;
      const tradeName =
        hit.title && hit.title !== hit.co_name ? hit.title : undefined;
      return {
        name: hit.co_name,
        tradeName,
        arGemi: hit.arGemi != null ? String(hit.arGemi) : undefined,
        companyStatus: hit.companyStatus,
      };
    } catch {
      return null;
    }
  },
};
