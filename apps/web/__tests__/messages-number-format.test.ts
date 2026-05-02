import { describe, it, expect } from "vitest";
import en from "../messages/en.json";
import el from "../messages/el.json";
import es from "../messages/es.json";

describe("numberFormat locale parity (#281)", () => {
  const locales = { en, el, es };
  it.each(Object.keys(locales))(
    "%s has non-empty numberFormatEu / numberFormatUs / numberFormatFr",
    (loc) => {
      const messages = locales[loc as keyof typeof locales];
      const settings = messages.settingsGeneral as Record<string, string>;
      for (const k of ["numberFormatEu", "numberFormatUs", "numberFormatFr"]) {
        expect(settings[k], `${loc}.settingsGeneral.${k}`).toBeDefined();
        expect(settings[k].trim().length).toBeGreaterThan(0);
      }
    },
  );
});
