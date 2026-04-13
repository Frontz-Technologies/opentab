import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { expenseAttachments, expenses } from "@opentab/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveFile } from "@/lib/expenses/file-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const filePath = path.join("/");

  // Verify the file belongs to the user's org
  const [attachment] = await db
    .select({
      id: expenseAttachments.id,
      mimeType: expenseAttachments.mimeType,
      fileName: expenseAttachments.fileName,
      expenseId: expenseAttachments.expenseId,
    })
    .from(expenseAttachments)
    .innerJoin(expenses, eq(expenses.id, expenseAttachments.expenseId))
    .where(
      and(
        eq(expenseAttachments.filePath, filePath),
        eq(expenses.orgId, session.org.id),
      ),
    );

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await retrieveFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${attachment.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
