import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "crypto";

// Set a stable test key BEFORE importing the module (reads env at import time? No — reads at call time)
beforeAll(() => {
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  }
});

import {
  encryptField,
  decryptField,
  encryptConfig,
  decryptConfig,
  maskConfig,
} from "../lib/country/crypto";

describe("crypto", () => {
  describe("encryptField / decryptField", () => {
    it("round-trips a simple string", () => {
      const ciphertext = encryptField("hello world");
      expect(ciphertext).not.toBe("hello world");
      expect(decryptField(ciphertext)).toBe("hello world");
    });

    it("produces distinct ciphertexts for the same plaintext (random IV)", () => {
      const a = encryptField("same");
      const b = encryptField("same");
      expect(a).not.toBe(b);
      expect(decryptField(a)).toBe("same");
      expect(decryptField(b)).toBe("same");
    });

    it("handles empty strings and unicode", () => {
      expect(decryptField(encryptField(""))).toBe("");
      expect(decryptField(encryptField("héllo — αβγ — 日本語"))).toBe(
        "héllo — αβγ — 日本語",
      );
    });

    it("rejects tampered ciphertext", () => {
      const ciphertext = encryptField("secret");
      const [iv, tag, payload] = ciphertext.split(":");
      const tamperedPayload = Buffer.from(payload, "base64");
      tamperedPayload[0] = tamperedPayload[0] ^ 0xff;
      const tampered = [iv, tag, tamperedPayload.toString("base64")].join(":");
      expect(() => decryptField(tampered)).toThrow();
    });
  });

  describe("encryptConfig / decryptConfig", () => {
    it("encrypts non-public fields and leaves public fields as-is", () => {
      const config = {
        aadeUserId: "user123",
        environment: "sandbox",
        subscriptionKey: "super-secret",
      };
      const encrypted = encryptConfig(config, ["aadeUserId", "environment"]);
      expect(encrypted.aadeUserId).toBe("user123");
      expect(encrypted.environment).toBe("sandbox");
      expect(encrypted.subscriptionKey).not.toBe("super-secret");
      expect(typeof encrypted.subscriptionKey).toBe("string");
    });

    it("round-trips through decryptConfig", () => {
      const config = {
        aadeUserId: "user123",
        environment: "sandbox",
        subscriptionKey: "super-secret",
      };
      const encrypted = encryptConfig(config, ["aadeUserId", "environment"]);
      const decrypted = decryptConfig<typeof config>(encrypted, [
        "aadeUserId",
        "environment",
      ]);
      expect(decrypted).toEqual(config);
    });

    it("encrypts every field when publicFields is empty (opt-OUT safety)", () => {
      const config = { foo: "bar", baz: "qux" };
      const encrypted = encryptConfig(config, []);
      expect(encrypted.foo).not.toBe("bar");
      expect(encrypted.baz).not.toBe("qux");
      const decrypted = decryptConfig<typeof config>(encrypted, []);
      expect(decrypted).toEqual(config);
    });

    it("preserves null / undefined values without encryption", () => {
      const config = { a: null, b: undefined, c: "value" };
      const encrypted = encryptConfig(config, []);
      expect(encrypted.a).toBeNull();
      expect(encrypted.b).toBeUndefined();
      expect(encrypted.c).not.toBe("value");
    });

    it("serialises non-string values via JSON before encryption", () => {
      const config = { n: 42, obj: { nested: true } };
      const encrypted = encryptConfig(config, []);
      const decrypted = decryptConfig<typeof config>(encrypted, []);
      expect(decrypted.n).toBe(42);
      expect(decrypted.obj).toEqual({ nested: true });
    });
  });

  describe("maskConfig", () => {
    it("redacts non-public field values", () => {
      const config = {
        aadeUserId: "user123",
        environment: "sandbox",
        subscriptionKey: "super-secret",
      };
      const masked = maskConfig(config, ["aadeUserId", "environment"]);
      expect(masked).toEqual({
        aadeUserId: "user123",
        environment: "sandbox",
        subscriptionKey: "***",
      });
    });

    it("redacts everything when publicFields is empty", () => {
      const masked = maskConfig({ a: "1", b: "2" }, []);
      expect(masked).toEqual({ a: "***", b: "***" });
    });
  });
});
