import type { CompanyLookupResult } from "../types";

const AADE_URL = "https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2";

export async function lookupGreekAfm(
  afm: string,
): Promise<CompanyLookupResult | null> {
  const cleaned = afm.replace(/\s/g, "");
  if (!/^\d{9}$/.test(cleaned)) return null;

  try {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:rgw="http://rgwspublic2/RgWsPublic2Service">
  <soap:Body>
    <rgw:rgWsPublic2AfmMethod>
      <INPUT>
        <afm_called_by></afm_called_by>
        <afm_called_for>${cleaned}</afm_called_for>
      </INPUT>
    </rgw:rgWsPublic2AfmMethod>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(AADE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: "",
      },
      body: soapBody,
    });

    if (!response.ok) return null;

    const xml = await response.text();
    return parseAadeResponse(xml);
  } catch {
    return null;
  }
}

function parseAadeResponse(xml: string): CompanyLookupResult | null {
  const extract = (tag: string): string | undefined => {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match?.[1]?.trim() || undefined;
  };

  const name = extract("onomasia");
  if (!name) return null;

  return {
    name,
    tradeName: extract("commer_title"),
    address:
      [extract("postal_address"), extract("postal_address_no")]
        .filter(Boolean)
        .join(" ") || undefined,
    city: extract("postal_area_description"),
    postalCode: extract("postal_zip_code"),
    taxOffice: extract("doy_descr"),
    activity: extract("firm_act_descr"),
  };
}
