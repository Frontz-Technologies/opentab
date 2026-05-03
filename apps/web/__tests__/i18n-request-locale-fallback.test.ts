import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// next-intl's getRequestConfig returns a function whose argument is invoked
// at request time. We capture that callback so each test case can drive it.
const { cookieGet, getSessionMock, dbSelectMock } = vi.hoisted(() => ({
  cookieGet: vi.fn<(name: string) => { value: string } | undefined>(),
  getSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getRequestConfig: (cb: (...args: unknown[]) => unknown) => cb,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: dbSelectMock,
  },
}));

// Drizzle-orm `eq` helper is used by the implementation. The drizzle pgCore
// schema imported transitively from @opentab/db/schema will pull in heavy
// runtime — easier to keep the real eq export and stub the schema.
vi.mock("@opentab/db/schema", () => ({
  userPreferences: {
    locale: { name: "locale" },
    userId: { name: "user_id" },
  },
}));

// Helper to build the chained drizzle-style select().from().where() result.
function mockDbReturning(rows: Array<{ locale: string }>) {
  dbSelectMock.mockReturnValue({
    from: () => ({
      where: () => Promise.resolve(rows),
    }),
  });
}

beforeEach(() => {
  cookieGet.mockReset();
  getSessionMock.mockReset();
  dbSelectMock.mockReset();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadHandler() {
  const mod = await import("../i18n/request");
  // getRequestConfig was mocked to return its callback unmodified.
  return mod.default as () => Promise<{
    locale: string;
    messages: unknown;
  }>;
}

describe("i18n/request locale resolution", () => {
  it("uses the cookie when present and valid", async () => {
    cookieGet.mockReturnValue({ value: "el" });

    const handler = await loadHandler();
    const result = await handler();

    expect(result.locale).toBe("el");
    // No DB lookup needed when cookie is valid.
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it("falls back to userPreferences.locale when cookie is absent", async () => {
    cookieGet.mockReturnValue(undefined);
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    mockDbReturning([{ locale: "es" }]);

    const handler = await loadHandler();
    const result = await handler();

    expect(result.locale).toBe("es");
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(dbSelectMock).toHaveBeenCalledTimes(1);
  });

  it("returns 'en' when cookie absent and no session", async () => {
    cookieGet.mockReturnValue(undefined);
    getSessionMock.mockResolvedValue(null);

    const handler = await loadHandler();
    const result = await handler();

    expect(result.locale).toBe("en");
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it("treats invalid cookie value as missing and falls through", async () => {
    cookieGet.mockReturnValue({ value: "xx" });
    getSessionMock.mockResolvedValue(null);

    const handler = await loadHandler();
    const result = await handler();

    expect(result.locale).toBe("en");
  });

  it("returns 'en' when cookie absent, session present, but no userPreferences row exists", async () => {
    cookieGet.mockReturnValue(undefined);
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    mockDbReturning([]);

    const handler = await loadHandler();
    const result = await handler();

    expect(result.locale).toBe("en");
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(dbSelectMock).toHaveBeenCalledTimes(1);
  });

  it("returns 'en' when cookie absent and DB returns an invalid/legacy locale", async () => {
    cookieGet.mockReturnValue(undefined);
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    mockDbReturning([{ locale: "de" }]);

    const handler = await loadHandler();
    const result = await handler();

    expect(result.locale).toBe("en");
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(dbSelectMock).toHaveBeenCalledTimes(1);
  });

  it("returns 'en' when cookie absent and the DB query rejects", async () => {
    cookieGet.mockReturnValue(undefined);
    getSessionMock.mockResolvedValue({ user: { id: "user-1" } });
    function mockDbRejecting() {
      dbSelectMock.mockReturnValue({
        from: () => ({
          where: () => Promise.reject(new Error("boom")),
        }),
      });
    }
    mockDbRejecting();
    // The implementation logs a warning via console.warn — silence it for
    // this test only so vitest's reporter stays clean.
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const handler = await loadHandler();
    const result = await handler();

    expect(result.locale).toBe("en");
    expect(warnSpy).toHaveBeenCalledWith(
      "[i18n] locale fallback DB lookup failed",
      expect.any(Error),
    );
  });
});
