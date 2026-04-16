import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getFile, getPresignedUrl } from "@/lib/expenses/file-storage";

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
    // S3 mode: redirect to presigned URL
    const presignedUrl = await getPresignedUrl(relativePath, 3600);
    if (presignedUrl) {
      return NextResponse.redirect(presignedUrl);
    }

    // Local mode: serve file bytes directly
    const buffer = await getFile(relativePath);
    const ext = relativePath.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
    };

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeTypes[ext ?? ""] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
