import { describe, it, expect } from "vitest";
import { parseResponse } from "../lib/mydata/xml-parser";

describe("mydata xml-parser", () => {
  it("parses a successful response", () => {
    const xml = `<ResponseDoc>
  <response>
    <index>1</index>
    <invoiceUid>A1B2C3D4-E5F6-7890</invoiceUid>
    <invoiceMark>400001234567890</invoiceMark>
    <qrUrl>https://mydata.aade.gr/qr/test123</qrUrl>
    <statusCode>Success</statusCode>
  </response>
</ResponseDoc>`;

    const results = parseResponse(xml);

    expect(results).toHaveLength(1);
    expect(results[0].index).toBe(1);
    expect(results[0].invoiceUid).toBe("A1B2C3D4-E5F6-7890");
    expect(results[0].invoiceMark).toBe("400001234567890");
    expect(results[0].qrUrl).toBe("https://mydata.aade.gr/qr/test123");
    expect(results[0].statusCode).toBe("Success");
    expect(results[0].errors).toBeUndefined();
  });

  it("parses an error response", () => {
    const xml = `<ResponseDoc>
  <response>
    <index>1</index>
    <invoiceUid></invoiceUid>
    <invoiceMark></invoiceMark>
    <statusCode>Error</statusCode>
    <errors>
      <error>
        <code>XML_VALIDATION</code>
        <message>Invalid VAT number format</message>
      </error>
    </errors>
  </response>
</ResponseDoc>`;

    const results = parseResponse(xml);

    expect(results).toHaveLength(1);
    expect(results[0].statusCode).toBe("Error");
    expect(results[0].errors).toHaveLength(1);
    expect(results[0].errors![0].code).toBe("XML_VALIDATION");
    expect(results[0].errors![0].message).toBe("Invalid VAT number format");
  });

  it("parses multiple responses", () => {
    const xml = `<ResponseDoc>
  <response>
    <index>1</index>
    <invoiceUid>uid-1</invoiceUid>
    <invoiceMark>mark-1</invoiceMark>
    <qrUrl>https://example.com/qr1</qrUrl>
    <statusCode>Success</statusCode>
  </response>
  <response>
    <index>2</index>
    <invoiceUid>uid-2</invoiceUid>
    <invoiceMark>mark-2</invoiceMark>
    <qrUrl>https://example.com/qr2</qrUrl>
    <statusCode>Success</statusCode>
  </response>
</ResponseDoc>`;

    const results = parseResponse(xml);

    expect(results).toHaveLength(2);
    expect(results[0].invoiceMark).toBe("mark-1");
    expect(results[1].invoiceMark).toBe("mark-2");
  });

  it("throws on invalid XML structure", () => {
    expect(() => parseResponse("<Invalid>data</Invalid>")).toThrow(
      "Invalid myDATA response",
    );
  });

  it("parses response with multiple errors", () => {
    const xml = `<ResponseDoc>
  <response>
    <index>1</index>
    <statusCode>Error</statusCode>
    <errors>
      <error>
        <code>ERR_001</code>
        <message>First error</message>
      </error>
      <error>
        <code>ERR_002</code>
        <message>Second error</message>
      </error>
    </errors>
  </response>
</ResponseDoc>`;

    const results = parseResponse(xml);

    expect(results[0].errors).toHaveLength(2);
    expect(results[0].errors![0].code).toBe("ERR_001");
    expect(results[0].errors![1].code).toBe("ERR_002");
  });
});
