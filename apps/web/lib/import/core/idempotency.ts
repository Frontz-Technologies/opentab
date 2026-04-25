import { createHash } from "crypto";

const SEPARATOR = "\x1f"; // unit separator — won't appear in user data

// SHA-256 hex of the parts joined with a unit separator. Tuples are
// ordered: ["a", "b"] differs from ["b", "a"].
export function computeIdempotencyKey(parts: string[]): string {
  return createHash("sha256").update(parts.join(SEPARATOR)).digest("hex");
}
