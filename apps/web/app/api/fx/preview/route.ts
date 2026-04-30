import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getFxRate } from "@/lib/fx/get-rate";
import { isSupportedCurrency } from "@/lib/currency/supported";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
    const fx = await getFxRate(date, from, to);
    return NextResponse.json({
      rate: fx.rate,
      effectiveDate: fx.effectiveDate.toISOString().slice(0, 10),
      staleFallback: fx.staleFallback,
    });
  } catch {
    return NextResponse.json({ error: "rate-unavailable" }, { status: 503 });
  }
}
