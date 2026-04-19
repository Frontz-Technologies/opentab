// Runs once at Next.js server boot. Used to fail fast on misconfigured
// secrets before any request can hit a decrypt path.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEncryptionKey } = await import("./lib/country/crypto");
  assertEncryptionKey();
}
