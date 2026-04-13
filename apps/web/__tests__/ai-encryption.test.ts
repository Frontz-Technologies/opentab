import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "@/lib/ai/encryption";

describe("AI encryption", () => {
  it("round-trips an API key", () => {
    process.env.AI_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const encrypted = encryptApiKey("sk-or-test");
    const decrypted = decryptApiKey(encrypted.encrypted, encrypted.iv);

    expect(decrypted).toBe("sk-or-test");
    expect(encrypted.last4).toBe("test");
  });
});
