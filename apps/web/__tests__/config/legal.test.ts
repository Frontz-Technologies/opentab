import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLegalUrls } from "@/lib/config/legal";

const ENVS = ["LEGAL_TERMS_URL", "LEGAL_PRIVACY_URL"] as const;

describe("getLegalUrls", () => {
  beforeEach(() => {
    for (const k of ENVS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENVS) delete process.env[k];
  });

  it("returns nulls when neither env is set", () => {
    expect(getLegalUrls()).toEqual({ termsUrl: null, privacyUrl: null });
  });

  it("returns http(s) URLs untouched", () => {
    process.env.LEGAL_TERMS_URL = "https://example.com/terms";
    process.env.LEGAL_PRIVACY_URL = "http://example.com/privacy";
    expect(getLegalUrls()).toEqual({
      termsUrl: "https://example.com/terms",
      privacyUrl: "http://example.com/privacy",
    });
  });

  it("drops javascript: URLs", () => {
    process.env.LEGAL_TERMS_URL = "javascript:alert(1)";
    expect(getLegalUrls().termsUrl).toBeNull();
  });

  it("drops data: URLs", () => {
    process.env.LEGAL_TERMS_URL = "data:text/html,<script>alert(1)</script>";
    expect(getLegalUrls().termsUrl).toBeNull();
  });

  it("drops file: URLs", () => {
    process.env.LEGAL_TERMS_URL = "file:///etc/passwd";
    expect(getLegalUrls().termsUrl).toBeNull();
  });

  it("drops malformed values", () => {
    process.env.LEGAL_TERMS_URL = "not a url at all";
    expect(getLegalUrls().termsUrl).toBeNull();
  });

  it("drops empty string the same as unset", () => {
    process.env.LEGAL_TERMS_URL = "";
    expect(getLegalUrls().termsUrl).toBeNull();
  });

  it("validates each env independently — bad terms doesn't drop good privacy", () => {
    process.env.LEGAL_TERMS_URL = "javascript:bad";
    process.env.LEGAL_PRIVACY_URL = "https://example.com/privacy";
    expect(getLegalUrls()).toEqual({
      termsUrl: null,
      privacyUrl: "https://example.com/privacy",
    });
  });
});
