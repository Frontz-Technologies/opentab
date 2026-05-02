import { describe, it, expect } from "vitest";
import en from "../messages/en.json";
import el from "../messages/el.json";
import es from "../messages/es.json";

// Regression for PR #284 QA bug 1: `tCommon("clear")` is rendered on the
// supplier "clear" button in the contact-pinned state of /expenses/new.
// A missing key falls through to the literal "common.clear" + a runtime
// IntlError. Pin presence in every shipped locale so a future translation
// edit cannot drop it silently.
describe("common.clear locale parity (#284)", () => {
  const locales = { en, el, es };

  it.each(Object.keys(locales))("%s has a non-empty common.clear", (loc) => {
    const messages = locales[loc as keyof typeof locales];
    expect(messages.common.clear).toBeDefined();
    expect(typeof messages.common.clear).toBe("string");
    expect(messages.common.clear.trim().length).toBeGreaterThan(0);
  });
});
