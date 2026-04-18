import { describe, it, expect } from "vitest";
import { resolveTheme } from "../lib/theme";

describe("resolveTheme", () => {
  it("dark preference is always dark", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("light preference is always light", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("system follows OS preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("null / undefined / unknown defaults to dark", () => {
    expect(resolveTheme(null, false)).toBe("dark");
    expect(resolveTheme(undefined, false)).toBe("dark");
    expect(resolveTheme("sepia", false)).toBe("dark");
  });
});
