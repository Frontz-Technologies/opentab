import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string (64 chars)");
  }
  return buf;
}

export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptField(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }
  const [ivB64, authTagB64, encryptedB64] = parts;
  if (!ivB64 || !authTagB64) {
    throw new Error("Invalid ciphertext format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypt every field in `config` whose key is NOT listed in `publicFields`.
 * Opt-OUT encryption — safer default: if an integration author adds a new
 * field and forgets to list it, the field is encrypted, not leaked.
 *
 * Non-string values are JSON-serialised before encryption.
 */
export function encryptConfig(
  config: Record<string, unknown>,
  publicFields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const publicSet = new Set(publicFields);
  for (const [k, v] of Object.entries(config)) {
    if (publicSet.has(k)) {
      out[k] = v;
      continue;
    }
    if (v === null || v === undefined) {
      out[k] = v;
      continue;
    }
    const serialised = typeof v === "string" ? v : JSON.stringify(v);
    out[k] = encryptField(serialised);
  }
  return out;
}

export function decryptConfig<T extends Record<string, unknown>>(
  stored: Record<string, unknown>,
  publicFields: string[],
): T {
  const out: Record<string, unknown> = {};
  const publicSet = new Set(publicFields);
  for (const [k, v] of Object.entries(stored)) {
    if (publicSet.has(k) || v === null || v === undefined) {
      out[k] = v;
      continue;
    }
    if (typeof v !== "string") {
      out[k] = v;
      continue;
    }
    const plaintext = decryptField(v);
    try {
      out[k] = JSON.parse(plaintext);
    } catch {
      out[k] = plaintext;
    }
  }
  return out as T;
}

/**
 * Redact all non-public field values for safe logging.
 * Never pass a decrypted config to a logger without passing it through this first.
 */
export function maskConfig(
  config: Record<string, unknown>,
  publicFields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const publicSet = new Set(publicFields);
  for (const [k, v] of Object.entries(config)) {
    out[k] = publicSet.has(k) ? v : "***";
  }
  return out;
}
