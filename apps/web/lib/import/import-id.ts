// `tmp_<uuid-v4>` — minted server-side in uploadImportCsv via
// `tmp_${randomUUID()}`. Validated wherever the wizard hands an
// importId back to the server (commit / cleanup) so a malicious
// caller can't sneak path-traversal segments through the storage-key
// interpolation on the local-FS backend.
//
// Lives outside the "use server" actions module because Next.js
// requires every export from a Server Action file to be async.
export const IMPORT_ID_REGEX =
  /^tmp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidImportId(id: unknown): id is string {
  return typeof id === "string" && IMPORT_ID_REGEX.test(id);
}
