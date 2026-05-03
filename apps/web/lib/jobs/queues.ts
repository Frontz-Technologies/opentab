import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { QueueName, JobPayload } from "./types";

// Single Redis connection reused across queues + workers in this
// process. Lazy so importing this module from a server action never
// connects until the first enqueue.
let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error(
        "REDIS_URL not set — cannot enqueue jobs. Configure it in .env.local or your deployment.",
      );
    }
    connection = new IORedis(url, {
      maxRetriesPerRequest: null, // BullMQ requirement
    });
  }
  return connection;
}

const queueRegistry = new Map<QueueName, Queue>();

function getQueue(name: QueueName): Queue {
  let q = queueRegistry.get(name);
  if (!q) {
    q = new Queue(name, { connection: getRedisConnection() });
    queueRegistry.set(name, q);
  }
  return q;
}

// Default retry policy: 3 attempts, exponential backoff starting 5s.
// Override per-job via the third argument to enqueue() when needed.
//
// removeOnFail caps both age AND count so a runaway producer that
// fails every job indefinitely cannot OOM Redis before the 7-day
// window starts expiring. The 1000-job cap matches removeOnComplete;
// high-volume queues should pass tighter limits via the opts arg.
const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1000 }, // 24h / 1k
  removeOnFail: { age: 60 * 60 * 24 * 7, count: 1000 }, // 7d / 1k
};

export async function enqueue<Q extends QueueName>(
  queue: Q,
  payload: JobPayload<Q>,
  opts: Partial<typeof DEFAULT_JOB_OPTS> = {},
): Promise<{ id: string }> {
  const job = await getQueue(queue).add(queue, payload, {
    ...DEFAULT_JOB_OPTS,
    ...opts,
  });
  // BullMQ assigns an id on every successful add. Treat the absence
  // as a runtime invariant violation so callers tracking jobs by id
  // never get a silently-empty string.
  if (!job.id) {
    throw new Error(`enqueue: BullMQ assigned no id for queue "${queue}"`);
  }
  return { id: job.id };
}

export function getRegisteredQueues(): Queue[] {
  return Array.from(queueRegistry.values());
}
