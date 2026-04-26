import { db } from "@/lib/db";
import { getRedisConnection } from "@/lib/jobs/queues";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const checks = { db: "ok" as "ok" | "fail", redis: "ok" as "ok" | "fail" };

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    checks.db = "fail";
  }

  try {
    const pong = await getRedisConnection().ping();
    if (pong !== "PONG") checks.redis = "fail";
  } catch {
    checks.redis = "fail";
  }

  const allOk = checks.db === "ok" && checks.redis === "ok";
  return Response.json(
    { status: allOk ? "ok" : "fail", ...checks },
    { status: allOk ? 200 : 503 },
  );
}
