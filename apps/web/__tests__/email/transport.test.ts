import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: "<test@local>" });
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

import { sendEmail, resetTransportForTests } from "../../lib/email/transport";

describe("email transport", () => {
  beforeEach(() => {
    sendMailMock.mockClear();
    createTransportMock.mockClear();
    resetTransportForTests();
    process.env.EMAIL_DRIVER = "smtp";
    process.env.EMAIL_SMTP_HOST = "smtp.test";
    process.env.EMAIL_SMTP_PORT = "587";
    process.env.EMAIL_SMTP_USER = "u";
    process.env.EMAIL_SMTP_PASSWORD = "p";
    process.env.EMAIL_FROM_ADDRESS = "noreply@example.com";
    process.env.EMAIL_FROM_NAME = "OpenTab";
  });

  it("sends an email through configured SMTP", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "Hi",
      text: "Hello",
    });
    expect(sendMailMock).toHaveBeenCalledOnce();
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.to).toBe("user@example.com");
    expect(arg.subject).toBe("Hi");
    expect(arg.text).toBe("Hello");
    expect(arg.from).toBe('"OpenTab" <noreply@example.com>');
  });

  it("reuses the transport across calls", async () => {
    await sendEmail({ to: "a@x", subject: "1", text: "1" });
    await sendEmail({ to: "b@x", subject: "2", text: "2" });
    expect(createTransportMock).toHaveBeenCalledOnce();
  });

  it("throws a helpful error when SMTP envs are missing", async () => {
    delete process.env.EMAIL_SMTP_HOST;
    resetTransportForTests();
    await expect(
      sendEmail({ to: "a@x", subject: "x", text: "x" }),
    ).rejects.toThrow(/EMAIL_SMTP_HOST/);
  });

  it("supports html alongside text", async () => {
    await sendEmail({
      to: "user@example.com",
      subject: "S",
      text: "T",
      html: "<p>T</p>",
    });
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.html).toBe("<p>T</p>");
  });

  it("logs error and re-throws when SMTP send fails", async () => {
    sendMailMock.mockRejectedValueOnce(
      new Error("EAUTH: authentication failed"),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendEmail({
        to: "user@example.com",
        subject: "Reset your password",
        text: "click here",
      }),
    ).rejects.toThrow(/EAUTH/);

    expect(errSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(errSpy.mock.calls[0][0] as string);
    expect(logged.level).toBe("error");
    expect(logged.module).toBe("email-transport");
    expect(logged.to).toBe("user@example.com");
    expect(logged.subject).toBe("Reset your password");
    expect(logged.error).toMatch(/EAUTH/);

    errSpy.mockRestore();
  });
});
