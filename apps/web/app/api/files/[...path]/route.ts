import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPresignedUrl } from "@/lib/expenses/file-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const relativePath = path.join("/");

  // Ensure user can only access their org's files
  if (!relativePath.startsWith(session.org.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = await getPresignedUrl(relativePath, 3600);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
