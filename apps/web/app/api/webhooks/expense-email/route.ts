import { NextRequest, NextResponse } from "next/server";

/**
 * Email inbox webhook endpoint for expense receipt forwarding.
 * Accepts inbound parsed emails from services like SendGrid/Mailgun.
 * Stub implementation — will be connected when email provider is configured.
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.EXPENSE_EMAIL_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Expected fields from email parsing service:
    // - from: sender email
    // - subject: email subject
    // - attachments: array of { filename, content (base64), content_type }
    const { from, attachments } = body as {
      from?: string;
      subject?: string;
      attachments?: Array<{
        filename: string;
        content: string;
        content_type: string;
      }>;
    };

    if (!from || !attachments?.length) {
      return NextResponse.json(
        { error: "No attachments found" },
        { status: 400 },
      );
    }

    // TODO: Match sender email to org, create expenses from attachments
    // This will be implemented when email provider is configured.

    return NextResponse.json({
      success: true,
      message: `Received ${attachments.length} attachment(s) from ${from}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
