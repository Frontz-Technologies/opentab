import { db } from "@/lib/db";
import { activities } from "@opentab/db/schema";
import { createLogger } from "@/lib/logging/logger";
import type { ActivityType, EntityType } from "@/lib/entities/activity";

const log = createLogger("activities");

export interface RecordActivityInput {
  orgId: string;
  entityType: EntityType;
  entityId: string;
  // null for cron / system / webhook writes; sets isSystem=true.
  userId: string | null;
  type: ActivityType;
  payload?: Record<string, unknown>;
}

// Best-effort audit writer. Failure of this insert MUST NOT
// propagate up to the caller — the parent action has already
// committed its own DB write. The audit table being temporarily
// unhealthy is acceptable; cancelling a successful invoice send
// because of it is not.
export async function recordActivity(
  input: RecordActivityInput,
): Promise<void> {
  try {
    await db.insert(activities).values({
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      type: input.type,
      payload: input.payload ?? null,
      isSystem: input.userId === null,
    });
  } catch (err) {
    log.error("activity write failed", {
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
      errorName: err instanceof Error ? err.name : "Unknown",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
