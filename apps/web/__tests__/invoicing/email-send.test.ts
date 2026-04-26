import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/email/transport", () => ({
  sendEmail: sendEmailMock,
}));

import { sendInvoiceEmail, generateInvoiceEmail } from "../../lib/invoicing/email";

describe("invoice email send (#224)", () => {
  beforeEach(() => sendEmailMock.mockClear());

  it("sendInvoiceEmail forwards to the transport", async () => {
    await sendInvoiceEmail("customer@example.com", { subject: "INV-1", body: "Hello" });
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "customer@example.com",
      subject: "INV-1",
      text: "Hello",
    });
  });

  it("generateInvoiceEmail uses the static fallback (no AI call) regardless of OPENROUTER_API_KEY", async () => {
    process.env.OPENROUTER_API_KEY = "sk-fake";
    const invoice = {
      invoiceNumber: "INV-42",
      total: "100.00",
      currencyCode: "EUR",
      dueDate: "2026-05-15",
    } as never;
    const result = await generateInvoiceEmail(invoice, "Acme Corp");
    expect(result.subject).toContain("INV-42");
    expect(result.body).toContain("Acme Corp");
    expect(result.body).toContain("100.00");
  });

  it("attaches PDF when buffer provided", async () => {
    await sendInvoiceEmail(
      "customer@example.com",
      { subject: "S", body: "B" },
      Buffer.from("PDF"),
    );
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: expect.stringMatching(/\.pdf$/),
            content: Buffer.from("PDF"),
            contentType: "application/pdf",
          }),
        ],
      }),
    );
  });
});
