import { z } from "zod";
import { activities } from "@opentab/db/schema";

export { activities };
export type { Activity, NewActivity } from "@opentab/db/schema";

// Polymorphic entity tag. Invoice + credit_note are written today;
// reserved names for future entities (#131 spec — non-goals section).
export const ENTITY_TYPE = {
  INVOICE: "invoice",
  CREDIT_NOTE: "credit_note",
  IMPORT: "import",
} as const;

export type EntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE];

// Closed string union of every audit event v1 emits. Keep strict so a
// typo at a writer call site is a compile error rather than an empty
// row in the CSV. Naming convention: `<entity>.<verb>` (invoice.*) or
// `<plugin>.<verb>` (mydata.*) — the entity prefix lets us filter the
// CSV at a glance even when the table widens to other entities.
export const ACTIVITY_TYPE = {
  INVOICE_CREATED: "invoice.created",
  INVOICE_UPDATED: "invoice.updated",
  INVOICE_PUBLISHED: "invoice.published",
  INVOICE_SENT: "invoice.sent",
  INVOICE_PAID: "invoice.paid",
  INVOICE_CANCELLED: "invoice.cancelled",
  INVOICE_DELETED: "invoice.deleted",
  CREDIT_NOTE_CREATED: "credit_note.created",
  CREDIT_NOTE_PUBLISHED: "credit_note.published",
  CREDIT_NOTE_SENT: "credit_note.sent",
  CREDIT_NOTE_CANCELLED: "credit_note.cancelled",
  CREDIT_NOTE_DELETED: "credit_note.deleted",
  MYDATA_SUBMITTED: "mydata.submitted",
  MYDATA_CONFIRMED: "mydata.confirmed",
  MYDATA_FAILED: "mydata.failed",
  IMPORT_RUN_COMPLETED: "import.run_completed",
} as const;

export type ActivityType = (typeof ACTIVITY_TYPE)[keyof typeof ACTIVITY_TYPE];

export const createActivitySchema = z.object({
  orgId: z.string().uuid(),
  entityType: z.enum([
    ENTITY_TYPE.INVOICE,
    ENTITY_TYPE.CREDIT_NOTE,
    ENTITY_TYPE.IMPORT,
  ]),
  entityId: z.string().uuid(),
  userId: z.string().nullable(),
  type: z.enum(
    Object.values(ACTIVITY_TYPE) as [ActivityType, ...ActivityType[]],
  ),
  payload: z.record(z.string(), z.unknown()).optional(),
});
