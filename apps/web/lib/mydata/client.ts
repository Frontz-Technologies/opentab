import type { MyDataConfig, MyDataInvoice, SendInvoiceResult } from "./types";
import { buildInvoicesDoc } from "./xml-builder";
import { parseResponse } from "./xml-parser";

const ENDPOINTS = {
  production: "https://mydatapi.aade.gr/myDATA",
  sandbox: "https://mydataapidev.aade.gr/myDATA",
} as const;

export class MyDataClient {
  private baseUrl: string;
  private aadeUserId: string;
  private subscriptionKey: string;

  constructor(config: MyDataConfig) {
    this.baseUrl = ENDPOINTS[config.environment];
    this.aadeUserId = config.aadeUserId;
    this.subscriptionKey = config.subscriptionKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      "aade-user-id": this.aadeUserId,
      "ocp-Apim-Subscription-Key": this.subscriptionKey,
      "Content-Type": "application/xml",
    };
  }

  async sendInvoices(invoices: MyDataInvoice[]): Promise<{
    results: SendInvoiceResult[];
    requestXml: string;
    responseXml: string;
  }> {
    const requestXml = buildInvoicesDoc(invoices);

    const response = await fetch(`${this.baseUrl}/SendInvoicesDoc`, {
      method: "POST",
      headers: this.getHeaders(),
      body: requestXml,
    });

    const responseXml = await response.text();

    if (!response.ok) {
      throw new MyDataApiError(
        `myDATA API error: ${response.status} ${response.statusText}`,
        response.status,
        responseXml,
      );
    }

    const results = parseResponse(responseXml);
    return { results, requestXml, responseXml };
  }

  async cancelInvoice(mark: string): Promise<{
    result: SendInvoiceResult;
    responseXml: string;
  }> {
    const response = await fetch(
      `${this.baseUrl}/CancelInvoice?mark=${encodeURIComponent(mark)}`,
      {
        method: "POST",
        headers: this.getHeaders(),
      },
    );

    const responseXml = await response.text();

    if (!response.ok) {
      throw new MyDataApiError(
        `myDATA API error: ${response.status} ${response.statusText}`,
        response.status,
        responseXml,
      );
    }

    const results = parseResponse(responseXml);
    return { result: results[0], responseXml };
  }
}

export class MyDataApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string,
  ) {
    super(message);
    this.name = "MyDataApiError";
  }
}
