import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getFxRateWithFallback } from "@/lib/fx";
import { isSupportedCurrency } from "@/lib/currency/supported";

// Per-session rate limit: 30 requests / 60s window.
//
// NOTE: this Map is process-local. Next.js may run multiple server
// instances (one per node, one per lambda), and each gets its own
// bucket — so the effective ceiling is RATE_LIMIT * instanceCount.
// Acceptable for v1; migrate to a Redis-backed limiter when we move
// to multi-instance deploys.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function checkRate(userId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count += 1;
  return true;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!checkRate(session.user.id)) {
    return new NextResponse(null, { status: 429 });
  }

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!dateStr || !from || !to) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }
  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) {
    return NextResponse.json(
      { error: "unsupported currency" },
      { status: 400 },
    );
  }

  const date = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }

  try {
    const fx = await getFxRateWithFallback(date, from, to);
    return NextResponse.json({
      rate: fx.rate,
      effectiveDate: fx.effectiveDate.toISOString().slice(0, 10),
      staleFallback: fx.staleFallback,
    });
  } catch {
    return NextResponse.json({ error: "rate-unavailable" }, { status: 503 });
  }
}
