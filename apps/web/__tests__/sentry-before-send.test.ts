import { describe, it, expect } from "vitest";
import { beforeSend } from "@/lib/sentry/before-send";

interface PartialEvent {
  request?: { url?: string };
}

function fakeEvent(url?: string): PartialEvent {
  return url ? { request: { url } } : {};
}

describe("beforeSend", () => {
  it("drops events whose request URL is /api/healthz", () => {
    expect(
      beforeSend(
        fakeEvent("https://app.opentab.tech/api/healthz") as never,
        {
          originalException: new Error("ignored"),
        } as never,
      ),
    ).toBeNull();
  });

  it("drops Next.js static-asset events", () => {
    expect(
      beforeSend(
        fakeEvent("https://app.opentab.tech/_next/static/abc.js") as never,
        { originalException: new Error("ignored") } as never,
      ),
    ).toBeNull();
  });

  it("drops Next.js image optimisation events", () => {
    expect(
      beforeSend(
        fakeEvent("https://app.opentab.tech/_next/image?url=x") as never,
        { originalException: new Error("ignored") } as never,
      ),
    ).toBeNull();
  });

  it("drops Better Auth deliberate Invalid* errors", () => {
    for (const message of [
      "Invalid redirectURL: https://app.opentab.tech/reset-password",
      "Invalid origin: https://app.opentab.tech",
      "Invalid callbackURL: /dashboard",
    ]) {
      expect(
        beforeSend(
          fakeEvent("https://app.opentab.tech/api/auth/x") as never,
          {
            originalException: new Error(message),
          } as never,
        ),
      ).toBeNull();
    }
  });

  it("forwards real errors on real routes", () => {
    const event = fakeEvent("https://app.opentab.tech/dashboard");
    expect(
      beforeSend(
        event as never,
        {
          originalException: new TypeError(
            "Cannot read properties of null (reading 'user')",
          ),
        } as never,
      ),
    ).toBe(event);
  });

  it("forwards events when no request URL is present (server-side throw)", () => {
    const event: PartialEvent = {};
    expect(
      beforeSend(
        event as never,
        {
          originalException: new Error("server crashed"),
        } as never,
      ),
    ).toBe(event);
  });

  it("treats string originalException safely", () => {
    const event = fakeEvent("https://app.opentab.tech/dashboard");
    expect(
      beforeSend(
        event as never,
        {
          originalException: "some non-Error value" as never,
        } as never,
      ),
    ).toBe(event);
  });
});
