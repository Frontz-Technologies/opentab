import { XMLParser } from "fast-xml-parser";
import type { SendInvoiceResult, MyDataError } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
});

export function parseResponse(xml: string): SendInvoiceResult[] {
  const parsed = parser.parse(xml);

  const responseDoc = parsed.ResponseDoc;
  if (!responseDoc) {
    throw new Error("Invalid myDATA response: missing ResponseDoc");
  }

  const responses = Array.isArray(responseDoc.response)
    ? responseDoc.response
    : [responseDoc.response];

  return responses.map((r: Record<string, unknown>): SendInvoiceResult => {
    const errors: MyDataError[] = [];

    if (r.errors) {
      const errorsObj = r.errors as Record<string, unknown>;
      const errorList = Array.isArray(errorsObj.error)
        ? errorsObj.error
        : errorsObj.error
          ? [errorsObj.error]
          : [];
      for (const e of errorList) {
        errors.push({
          code: String((e as Record<string, unknown>).code ?? ""),
          message: String((e as Record<string, unknown>).message ?? ""),
        });
      }
    }

    return {
      index: Number(r.index ?? 0),
      invoiceUid: String(r.invoiceUid ?? ""),
      invoiceMark: String(r.invoiceMark ?? ""),
      qrUrl: String(r.qrUrl ?? ""),
      statusCode: r.statusCode === "Success" ? "Success" : "Error",
      errors: errors.length > 0 ? errors : undefined,
    };
  });
}
