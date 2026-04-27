import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteTempFile } from "@/lib/expenses/file-storage";

// Accepts the navigator.sendBeacon POST that the import wizard fires
// on beforeunload. Server Actions can't accept beacon POSTs (they
// require a CSRF-style action header that sendBeacon doesn't add), so
// this route handler is the cleanup path for that one case.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { importId?: string };
  try {
    body = (await req.json()) as { importId?: string };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.importId || typeof body.importId !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const key = `${session.org.id}/imports/tmp/${body.importId}.csv`;
  await deleteTempFile(key);
  return NextResponse.json({ ok: true });
}
