import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const value = process.env.AI_ENCRYPTION_KEY;

  if (!value) {
    throw new Error("AI_ENCRYPTION_KEY environment variable is required");
  }

  const key = Buffer.from(value, "hex");
  if (key.length !== 32) {
    throw new Error("AI_ENCRYPTION_KEY must be a 32-byte hex string");
  }

  return key;
}

export function encryptApiKey(plaintext: string): {
  encrypted: string;
  iv: string;
  last4: string;
} {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("hex"),
    last4: plaintext.slice(-4),
  };
}

export function decryptApiKey(encrypted: string, iv: string): string {
  const payload = Buffer.from(encrypted, "base64");
  const encryptedBytes = payload.subarray(0, payload.length - AUTH_TAG_LENGTH);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, "hex"),
    { authTagLength: AUTH_TAG_LENGTH },
  );
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedBytes),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
