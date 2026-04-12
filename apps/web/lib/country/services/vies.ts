import type { CompanyLookupResult } from "../types";

const VIES_URL =
  "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";

interface ViesResponse {
  valid: boolean;
  name?: string;
  address?: string;
}

export async function validateViesVat(
  vatNumber: string,
): Promise<{ valid: boolean; company: CompanyLookupResult | null }> {
  const cleaned = vatNumber.replace(/\s/g, "").toUpperCase();
  const countryCode = cleaned.substring(0, 2);
  const number = cleaned.substring(2);

  try {
    const response = await fetch(VIES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode,
        vatNumber: number,
      }),
    });

    if (!response.ok) {
      return { valid: false, company: null };
    }

    const data: ViesResponse = await response.json();

    if (!data.valid) {
      return { valid: false, company: null };
    }

    const company: CompanyLookupResult = {
      name: data.name ?? "",
      address: data.address ?? undefined,
    };

    return { valid: true, company };
  } catch {
    return { valid: false, company: null };
  }
}
