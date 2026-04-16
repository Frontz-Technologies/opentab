import { describe, it, expect } from "vitest";
import { getExtractionStrategy } from "../lib/expenses/ai-extraction";

describe("getExtractionStrategy", () => {
  it("returns 'file' for PDF when model supports file", () => {
    const caps = { text: true, image: true, file: true };
    expect(getExtractionStrategy("application/pdf", caps)).toBe("file");
  });

  it("returns 'image' for PDF when model supports image but not file", () => {
    const caps = { text: true, image: true, file: false };
    expect(getExtractionStrategy("application/pdf", caps)).toBe("image");
  });

  it("returns null for PDF when model supports neither image nor file", () => {
    const caps = { text: true, image: false, file: false };
    expect(getExtractionStrategy("application/pdf", caps)).toBeNull();
  });

  it("returns 'image' for image files when model supports image", () => {
    const caps = { text: true, image: true, file: false };
    expect(getExtractionStrategy("image/png", caps)).toBe("image");
    expect(getExtractionStrategy("image/jpeg", caps)).toBe("image");
  });

  it("returns null for image files when model has no image support", () => {
    const caps = { text: true, image: false, file: false };
    expect(getExtractionStrategy("image/png", caps)).toBeNull();
  });

  it("returns null for unsupported file types", () => {
    const caps = { text: true, image: true, file: true };
    expect(getExtractionStrategy("text/plain", caps)).toBeNull();
  });
});
