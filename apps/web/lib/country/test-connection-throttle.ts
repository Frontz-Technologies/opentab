// Prevents "Test Connection" from being hammered against remote integration
// endpoints (quota + fingerprinting abuse). Uses the caller's existing
// lastValidatedAt timestamp — no extra state, no Redis, no memory map.
// Returns null if the call is allowed, or a user-facing error message if
// throttled.

const TEST_CONNECTION_THROTTLE_MS = 15_000;

export function throttleTestConnection(
  lastValidatedAt: Date | null,
): string | null {
  if (!lastValidatedAt) return null;
  const elapsed = Date.now() - lastValidatedAt.getTime();
  if (elapsed >= TEST_CONNECTION_THROTTLE_MS) return null;
  const waitSec = Math.ceil((TEST_CONNECTION_THROTTLE_MS - elapsed) / 1000);
  return `Please wait ${waitSec}s before testing again`;
}
