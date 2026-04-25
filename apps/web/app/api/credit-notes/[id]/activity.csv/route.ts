import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { creditNotes, activities, users } from "@opentab/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { activitiesToCsv } from "@/lib/activities/csv";
import { ENTITY_TYPE } from "@/lib/entities/activity";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("credit-note-activity-csv");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [creditNote] = await db
    .select({
      id: creditNotes.id,
      creditNoteNumber: creditNotes.creditNoteNumber,
    })
    .from(creditNotes)
    .where(and(eq(creditNotes.id, id), eq(creditNotes.orgId, session.org.id)));

  if (!creditNote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      createdAt: activities.createdAt,
      type: activities.type,
      payload: activities.payload,
      actorEmail: users.email,
    })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id))
    .where(
      and(
        eq(activities.entityType, ENTITY_TYPE.CREDIT_NOTE),
        eq(activities.entityId, id),
        eq(activities.orgId, session.org.id),
      ),
    )
    .orderBy(asc(activities.createdAt));

  log.info("credit note activity csv generated", {
    creditNoteId: id,
    orgId: session.org.id,
    rowCount: rows.length,
  });

  const csv = activitiesToCsv(
    rows.map((r) => ({
      createdAt: r.createdAt,
      actorEmail: r.actorEmail,
      type: r.type,
      payload: r.payload,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity-${creditNote.creditNoteNumber ?? `draft-cn-${creditNote.id.slice(0, 8)}`}.csv"`,
    },
  });
}
