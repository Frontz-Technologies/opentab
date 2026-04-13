import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  organisations,
  expenses,
  expenseAttachments,
} from "@opentab/db/schema";
import { eq } from "drizzle-orm";
import { EXPENSE_SOURCE, AI_STATUS } from "@opentab/db/schema";
import { computeFileHash } from "@/lib/expenses/duplicate-detection";
import {
  storeFile,
  buildExpenseFilePath,
  getExtensionFromMimeType,
  isProcessableFile,
  MAX_FILE_SIZE,
} from "@/lib/expenses/file-storage";

export async function POST(request: Request) {
  // 1. Verify webhook signature
  const signature = request.headers.get("x-webhook-signature");
  const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;

  if (webhookSecret && !signature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse email payload
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 3. Extract org slug from recipient address
  // Format: expenses-{slug}@opentab.tech
  const to = payload.to ?? payload.recipient ?? "";
  const slugMatch = to.match(/^expenses-([^@]+)@/);
  if (!slugMatch) {
    return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  }

  const slug = slugMatch[1];

  // 4. Look up organisation
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.slug, slug));

  if (!org) {
    return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  }

  // 5. Process each attachment
  const attachments = payload.attachments ?? [];
  const created: string[] = [];

  for (const attachment of attachments) {
    if (!isProcessableFile(attachment.mimeType ?? attachment.contentType)) {
      continue;
    }

    const buffer = Buffer.from(attachment.content ?? "", "base64");
    if (buffer.length > MAX_FILE_SIZE) continue;

    const fileHash = computeFileHash(buffer);

    // Generate a simple expense number based on timestamp
    const expenseNumber = `EXP-EMAIL-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    const [expense] = await db
      .insert(expenses)
      .values({
        orgId: org.id,
        expenseNumber,
        issueDate: today,
        source: EXPENSE_SOURCE.EMAIL,
        fileHash,
      })
      .returning();

    const ext = getExtensionFromMimeType(
      attachment.mimeType ?? attachment.contentType,
    );
    const relativePath = buildExpenseFilePath(org.id, expense.id, ext);
    await storeFile(relativePath, buffer);

    await db.insert(expenseAttachments).values({
      expenseId: expense.id,
      filePath: relativePath,
      fileName: attachment.filename ?? `receipt.${ext}`,
      fileSize: buffer.length,
      mimeType: attachment.mimeType ?? attachment.contentType,
      fileHash,
      aiStatus: AI_STATUS.PENDING,
    });

    created.push(expense.id);
  }

  return NextResponse.json({ ok: true, created });
}
