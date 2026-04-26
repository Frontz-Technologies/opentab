import { describe, it, expect, beforeEach } from "vitest";
import { deriveTrustedOrigins } from "../lib/auth-trusted-origins";

const ENVS = ["NEXT_PUBLIC_APP_URL", "APP_URL", "BETTER_AUTH_URL"] as const;

describe("deriveTrustedOrigins", () => {
  beforeEach(() => {
    for (const k of ENVS) delete process.env[k];
  });

  it("always includes the origin the request came in on", () => {
    const req = new Request("https://app.opentab.tech/api/auth/foo");
    expect(deriveTrustedOrigins(req)).toContain("https://app.opentab.tech");
  });

  it("includes NEXT_PUBLIC_APP_URL when set and strips trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.opentab.tech/";
    const req = new Request("https://other.example.com/api/auth/foo");
    const origins = deriveTrustedOrigins(req);
    expect(origins).toContain("https://app.opentab.tech");
    expect(origins).toContain("https://other.example.com");
  });

  it("falls through APP_URL and BETTER_AUTH_URL when NEXT_PUBLIC_APP_URL is unset", () => {
    process.env.APP_URL = "https://app.opentab.tech";
    process.env.BETTER_AUTH_URL = "https://auth.opentab.tech";
    const req = new Request("https://x.test/api");
    const origins = deriveTrustedOrigins(req);
    expect(origins).toContain("https://app.opentab.tech");
    expect(origins).toContain("https://auth.opentab.tech");
  });

  it("returns the request origin alone when no env is set", () => {
    const req = new Request("https://app.opentab.tech/api/auth/foo");
    expect(deriveTrustedOrigins(req)).toEqual(["https://app.opentab.tech"]);
  });

  it("deduplicates when env and request origin agree", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.opentab.tech";
    const req = new Request("https://app.opentab.tech/api/auth/foo");
    const origins = deriveTrustedOrigins(req);
    expect(
      origins.filter((o) => o === "https://app.opentab.tech"),
    ).toHaveLength(1);
  });
});
