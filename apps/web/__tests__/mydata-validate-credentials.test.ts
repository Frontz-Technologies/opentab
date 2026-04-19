import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { randomBytes } from "crypto";

beforeAll(() => {
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const { encryptField } = await import("../lib/country/crypto");
const { MydataIntegration: mydata } =
  await import("../lib/country/providers/gr/integrations/mydata");

function encryptedCreds() {
  return {
    aadeUserId: "test-user",
    subscriptionKey: encryptField("fake-key"),
    environment: "sandbox",
  };
}

function mockFetchResponse(status: number, body = "") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: `HTTP ${status}`,
      text: async () => body,
    })),
  );
}

describe("mydata validateCredentials", () => {
  it("returns ok:false when AADE returns 400 with fake creds", async () => {
    mockFetchResponse(
      400,
      "<Response><StatusCode>Invalid subscription</StatusCode></Response>",
    );

    const result = await mydata.validateCredentials!(encryptedCreds(), {
      orgId: "test-org",
    });

    expect(result.ok).toBe(false);
  });

  it("returns ok:false with 'Invalid credentials' on 401", async () => {
    mockFetchResponse(401);

    const result = await mydata.validateCredentials!(encryptedCreds(), {
      orgId: "test-org",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid credentials");
  });

  it("returns ok:false with 'Invalid credentials' on 403", async () => {
    mockFetchResponse(403);

    const result = await mydata.validateCredentials!(encryptedCreds(), {
      orgId: "test-org",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid credentials");
  });

  it("returns ok:true on HTTP 200", async () => {
    mockFetchResponse(
      200,
      '<?xml version="1.0" encoding="UTF-8"?><ResponseDoc></ResponseDoc>',
    );

    const result = await mydata.validateCredentials!(encryptedCreds(), {
      orgId: "test-org",
    });

    expect(result.ok).toBe(true);
  });

  it("returns ok:false when aadeUserId is missing", async () => {
    const result = await mydata.validateCredentials!(
      {
        aadeUserId: "",
        subscriptionKey: encryptField("k"),
        environment: "sandbox",
      },
      { orgId: "test-org" },
    );

    expect(result.ok).toBe(false);
  });
});
