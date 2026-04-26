// Queue names — enumerated so a typo at a queue.add() / Worker() call
// site is a compile error rather than a silently-dropped job.
export const QUEUE = {
  CLEANUP_TEMP_FILES: "cleanup-temp-files",
  DELETE_EXPENSE_FILES: "delete-expense-files",
  BACKUP: "backup",
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

// Payload shape per queue. Add a new entry when adding a new queue;
// the `enqueue<Q>` helper picks the matching shape via this map.
export interface JobPayloadMap {
  [QUEUE.CLEANUP_TEMP_FILES]: { ageHours: number };
  [QUEUE.DELETE_EXPENSE_FILES]: {
    orgId: string;
    expenseId: string;
    filePaths: string[];
  };
  [QUEUE.BACKUP]: Record<string, never>;
}

export type JobPayload<Q extends QueueName> = JobPayloadMap[Q];
