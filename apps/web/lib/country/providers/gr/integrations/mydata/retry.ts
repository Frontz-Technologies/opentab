export const MAX_ATTEMPTS = 5;

const BASE_DELAY_MS = 30_000; // 30 seconds
const MAX_DELAYS_MS = [
  60_000, // 1 minute
  300_000, // 5 minutes
  900_000, // 15 minutes
  3_600_000, // 1 hour
  14_400_000, // 4 hours
];

export function calculateBackoff(attempt: number): number {
  const cappedAttempt = Math.min(attempt, MAX_ATTEMPTS - 1);
  const maxDelay =
    MAX_DELAYS_MS[cappedAttempt] ?? MAX_DELAYS_MS[MAX_DELAYS_MS.length - 1];
  const baseDelay = BASE_DELAY_MS * Math.pow(2, cappedAttempt);
  const jitter = Math.random() * BASE_DELAY_MS;
  return Math.min(baseDelay + jitter, maxDelay);
}

export function getNextRetryAt(attempt: number): Date {
  const delayMs = calculateBackoff(attempt);
  return new Date(Date.now() + delayMs);
}

export function shouldRetry(attempt: number): boolean {
  return attempt < MAX_ATTEMPTS;
}
