import { describe, expect, it } from "vitest";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import type { SessionContext } from "@/lib/session";

describe("AI system prompt", () => {
  it("includes greek tax context for greek organisations", async () => {
    const session: SessionContext = {
      user: {
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        locale: "el",
      },
      org: {
        id: "org-1",
        name: "OpenTab",
        slug: "opentab",
        countryCode: "GR",
        defaultCurrency: "EUR",
        fiscalYearStart: 1,
        taxId: "EL123",
        taxAuthority: "Athens",
        addressLine1: null,
        addressLine2: null,
        city: null,
        postalCode: null,
        region: null,
        phone: null,
        setupCompletedSteps: [],
      },
      role: "owner",
    };

    const prompt = await getSystemPrompt(session);

    expect(prompt).toContain("Organisation: OpenTab");
    expect(prompt).toContain("Greek Tax Context");
    expect(prompt).toContain("VAT rates");
  });
});
