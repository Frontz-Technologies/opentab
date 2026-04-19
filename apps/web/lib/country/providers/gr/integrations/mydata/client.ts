import type { MyDataConfig, MyDataInvoice, SendInvoiceResult } from "./types";
import { buildInvoicesDoc } from "./xml-builder";
import { parseResponse } from "./xml-parser";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("mydata-client");

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

    const endpoint = `${this.baseUrl}/SendInvoicesDoc`;
    const done = log.time("sendInvoicesDoc");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.getHeaders(),
      body: requestXml,
    });

    const responseXml = await response.text();
    done("SendInvoicesDoc response", {
      endpoint,
      status: response.status,
      invoiceCount: invoices.length,
    });

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

  async checkCredentials(): Promise<void> {
    const endpoint = `${this.baseUrl}/RequestTransmittedDocs?mark=0`;
    const done = log.time("checkCredentials");
    const response = await fetch(endpoint, {
      method: "GET",
      headers: this.getHeaders(),
    });
    done("RequestTransmittedDocs response", {
      endpoint,
      status: response.status,
    });

    if (!response.ok) {
      const responseXml = await response.text();
      throw new MyDataApiError(
        `myDATA API error: ${response.status} ${response.statusText}`,
        response.status,
        responseXml,
      );
    }
  }

  async cancelInvoice(mark: string): Promise<{
    result: SendInvoiceResult;
    responseXml: string;
  }> {
    const endpoint = `${this.baseUrl}/CancelInvoice?mark=${encodeURIComponent(mark)}`;
    const done = log.time("cancelInvoice");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.getHeaders(),
    });

    const responseXml = await response.text();
    done("CancelInvoice response", { endpoint, status: response.status });

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
