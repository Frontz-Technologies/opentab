import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gemiPublicSource } from "../lib/business-lookup/sources/gemi-public";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gemiPublicSource", () => {
  it("supports only GR", () => {
    expect(gemiPublicSource.supports("GR")).toBe(true);
    expect(gemiPublicSource.supports("DE")).toBe(false);
  });

  it("priority is 5 (tried before VIES)", () => {
    expect(gemiPublicSource.priority).toBe(5);
  });

  it("isAvailable always resolves true", async () => {
    await expect(gemiPublicSource.isAvailable("any-org-id")).resolves.toBe(
      true,
    );
  });

  it("maps the first autocomplete hit to a CompanyLookupResult", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          payload: {
            autocomplete: [
              {
                id: 0,
                arGemi: 174184603000,
                title: "FRONTZ TECHNOLOGIES",
                co_name: "ΦΡΟΝΤΖΟΣ ΙΩΑΝΝΗΣ ΚΑΙ ΣΙΑ Ε.Ε.",
                afm: "802315517",
                companyStatus: "Ενεργή",
                companyStatusId: 3,
                type: "Επιχείρηση",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await gemiPublicSource.lookup("802315517", "org-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://publicity.businessportal.gr/api/autocomplete/802315517",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ token: null, language: "el" }),
      }),
    );
    expect(result).toEqual({
      name: "ΦΡΟΝΤΖΟΣ ΙΩΑΝΝΗΣ ΚΑΙ ΣΙΑ Ε.Ε.",
      tradeName: "FRONTZ TECHNOLOGIES",
      arGemi: "174184603000",
      companyStatus: "Ενεργή",
    });
  });

  it("omits tradeName when title equals co_name", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          payload: {
            autocomplete: [
              {
                arGemi: 1,
                title: "ACME",
                co_name: "ACME",
                afm: "111111111",
                companyStatus: "Ενεργή",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await gemiPublicSource.lookup("111111111", "org-1");

    expect(result?.tradeName).toBeUndefined();
  });

  it("returns null when payload.autocomplete is empty", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ payload: { autocomplete: [] } }), {
        status: 200,
      }),
    );

    const result = await gemiPublicSource.lookup("000000000", "org-1");

    expect(result).toBeNull();
  });

  it("returns null on non-200 response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 503 }));

    const result = await gemiPublicSource.lookup("802315517", "org-1");

    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network / abort)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network failure"));

    const result = await gemiPublicSource.lookup("802315517", "org-1");

    expect(result).toBeNull();
  });

  it("strips spaces from the AFM before calling the endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ payload: { autocomplete: [] } }), {
        status: 200,
      }),
    );

    await gemiPublicSource.lookup("802 315 517", "org-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://publicity.businessportal.gr/api/autocomplete/802315517",
      expect.anything(),
    );
  });

  it("strips the VIES EL prefix from canonical Greek VAT input", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ payload: { autocomplete: [] } }), {
        status: 200,
      }),
    );

    await gemiPublicSource.lookup("EL802315517", "org-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://publicity.businessportal.gr/api/autocomplete/802315517",
      expect.anything(),
    );
  });

  it("strips the EL prefix case-insensitively and with whitespace", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ payload: { autocomplete: [] } }), {
        status: 200,
      }),
    );

    await gemiPublicSource.lookup("el 802 315 517", "org-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://publicity.businessportal.gr/api/autocomplete/802315517",
      expect.anything(),
    );
  });
});
