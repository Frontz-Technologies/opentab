// Runs once at Next.js server boot. Used to fail fast on misconfigured
// secrets before any request can hit a decrypt path.
//
// Inlines the ENCRYPTION_KEY check rather than importing from
// lib/country/crypto — that module imports node:crypto, which webpack
// won't resolve under the edge-runtime bundle. Validation logic is
// trivial, duplicating it here keeps the boot path zero-cost.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string (64 chars)");
  }
}
