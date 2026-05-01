import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompanyLookupSource } from "../lib/business-lookup/source";

vi.mock("@/lib/utils", () => ({
  detectCountryFromTaxId: vi.fn(),
}));

vi.mock("../lib/business-lookup/registry", () => ({
  businessLookupSources: [] as CompanyLookupSource[],
}));

import { detectCountryFromTaxId } from "@/lib/utils";
import { businessLookupSources as sourcesMock } from "../lib/business-lookup/registry";
import { lookupCompany } from "../lib/business-lookup/orchestrator";

function fakeSource(opts: {
  id: string;
  supports: string[];
  priority: number;
  available?: boolean;
  result?: { name: string } | null;
}): CompanyLookupSource {
  return {
    id: opts.id,
    displayName: opts.id,
    priority: opts.priority,
    supports: (cc) => opts.supports.includes(cc),
    isAvailable: async () => opts.available ?? true,
    lookup: vi.fn().mockResolvedValue(opts.result ?? null),
  };
}

describe("lookupCompany orchestrator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sourcesMock.length = 0;
  });

  it("returns null when country cannot be detected", async () => {
    vi.mocked(detectCountryFromTaxId).mockReturnValue(null);

    const out = await lookupCompany("garbage", "org-1");

    expect(out).toEqual({ result: null, sourceUsed: null });
  });

  it("calls only sources that support the detected country", async () => {
    vi.mocked(detectCountryFromTaxId).mockReturnValue("GR");
    const grSource = fakeSource({
      id: "gr",
      supports: ["GR"],
      priority: 10,
      result: { name: "ACME" },
    });
    const deSource = fakeSource({
      id: "de",
      supports: ["DE"],
      priority: 10,
      result: { name: "WRONG" },
    });
    sourcesMock.push(grSource, deSource);

    const out = await lookupCompany("GR123", "org-1");

    expect(grSource.lookup).toHaveBeenCalledOnce();
    expect(deSource.lookup).not.toHaveBeenCalled();
    expect(out).toEqual({ result: { name: "ACME" }, sourceUsed: "gr" });
  });

  it("tries lower-priority source first; first non-null result wins", async () => {
    vi.mocked(detectCountryFromTaxId).mockReturnValue("GR");
    const high = fakeSource({
      id: "high",
      supports: ["GR"],
      priority: 50,
      result: { name: "FALLBACK" },
    });
    const low = fakeSource({
      id: "low",
      supports: ["GR"],
      priority: 10,
      result: { name: "PRIMARY" },
    });
    sourcesMock.push(high, low);

    const out = await lookupCompany("GR123", "org-1");

    expect(low.lookup).toHaveBeenCalledOnce();
    expect(high.lookup).not.toHaveBeenCalled();
    expect(out.sourceUsed).toBe("low");
    expect(out.result?.name).toBe("PRIMARY");
  });

  it("falls through when the higher-priority source returns null", async () => {
    vi.mocked(detectCountryFromTaxId).mockReturnValue("GR");
    const primary = fakeSource({
      id: "primary",
      supports: ["GR"],
      priority: 10,
      result: null,
    });
    const fallback = fakeSource({
      id: "fallback",
      supports: ["GR"],
      priority: 50,
      result: { name: "RECOVERED" },
    });
    sourcesMock.push(primary, fallback);

    const out = await lookupCompany("GR123", "org-1");

    expect(primary.lookup).toHaveBeenCalledOnce();
    expect(fallback.lookup).toHaveBeenCalledOnce();
    expect(out.sourceUsed).toBe("fallback");
  });

  it("skips sources that report not available", async () => {
    vi.mocked(detectCountryFromTaxId).mockReturnValue("GR");
    const off = fakeSource({
      id: "off",
      supports: ["GR"],
      priority: 10,
      available: false,
      result: { name: "SHOULD-NOT-RETURN" },
    });
    const on = fakeSource({
      id: "on",
      supports: ["GR"],
      priority: 50,
      available: true,
      result: { name: "OK" },
    });
    sourcesMock.push(off, on);

    const out = await lookupCompany("GR123", "org-1");

    expect(off.lookup).not.toHaveBeenCalled();
    expect(out.sourceUsed).toBe("on");
  });

  it("returns null when every supported source returns null", async () => {
    vi.mocked(detectCountryFromTaxId).mockReturnValue("GR");
    const a = fakeSource({ id: "a", supports: ["GR"], priority: 10 });
    const b = fakeSource({ id: "b", supports: ["GR"], priority: 50 });
    sourcesMock.push(a, b);

    const out = await lookupCompany("GR123", "org-1");

    expect(out).toEqual({ result: null, sourceUsed: null });
  });

  it("continues to next source if one throws unexpectedly", async () => {
    vi.mocked(detectCountryFromTaxId).mockReturnValue("GR");
    const broken = fakeSource({
      id: "broken",
      supports: ["GR"],
      priority: 10,
    });
    (broken.lookup as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );
    const good = fakeSource({
      id: "good",
      supports: ["GR"],
      priority: 50,
      result: { name: "RESCUED" },
    });
    sourcesMock.push(broken, good);

    const out = await lookupCompany("GR123", "org-1");

    expect(out.sourceUsed).toBe("good");
  });
});
