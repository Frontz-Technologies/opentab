import nodemailer, { type Transporter } from "nodemailer";
import { createLogger } from "../logging/logger";

const log = createLogger("email-transport");

interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.EMAIL_SMTP_HOST;
  const port = process.env.EMAIL_SMTP_PORT;
  const user = process.env.EMAIL_SMTP_USER;
  const password = process.env.EMAIL_SMTP_PASSWORD;

  if (!host) throw new Error("EMAIL_SMTP_HOST is not set");
  if (!port) throw new Error("EMAIL_SMTP_PORT is not set");
  if (!user) throw new Error("EMAIL_SMTP_USER is not set");
  if (!password) throw new Error("EMAIL_SMTP_PASSWORD is not set");

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass: password },
  });

  return cachedTransporter;
}

function getFromHeader(): string {
  const addr = process.env.EMAIL_FROM_ADDRESS;
  const name = process.env.EMAIL_FROM_NAME ?? "OpenTab";
  if (!addr) throw new Error("EMAIL_FROM_ADDRESS is not set");
  return `"${name}" <${addr}>`;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const transporter = getTransporter();
  const from = getFromHeader();
  try {
    const result = await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      attachments: args.attachments,
    });
    log.info("email sent", {
      to: args.to,
      subject: args.subject,
      messageId: result.messageId,
    });
  } catch (err) {
    // Better Auth's sendResetPassword swallows exceptions on purpose to
    // prevent user-enumeration. Log here so SMTP failures still surface
    // in the operator's logs (and Sentry/GlitchTip) regardless of caller.
    log.error("email send failed", {
      to: args.to,
      subject: args.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export function resetTransportForTests(): void {
  cachedTransporter = null;
}
