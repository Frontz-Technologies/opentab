// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../messages/en.json";
import { CurrencyCombobox } from "../components/ui/currency-combobox";

// jsdom shims for browser globals consumed by Base UI / cmdk.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (
  typeof Element !== "undefined" &&
  !(Element.prototype as unknown as { scrollIntoView?: () => void })
    .scrollIntoView
) {
  (
    Element.prototype as unknown as { scrollIntoView: () => void }
  ).scrollIntoView = () => {};
}

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);

// Underlying Combobox primitive renders the trigger as a <button> with
// aria-haspopup="listbox" (Base UI Popover), not role="combobox".
const getTrigger = () =>
  screen.getByRole("button", { expanded: false }) as HTMLButtonElement;

describe("CurrencyCombobox", () => {
  it("renders the current value on the trigger", () => {
    render(wrap(<CurrencyCombobox value="EUR" onChange={() => {}} />));
    const trigger = getTrigger();
    expect(trigger.textContent).toMatch(/EUR/);
  });

  it("calls onChange with the new code on selection", async () => {
    const onChange = vi.fn();
    render(wrap(<CurrencyCombobox value="EUR" onChange={onChange} />));
    fireEvent.click(getTrigger());
    // Dropdown items render labels like "USD — US Dollar"; match flexibly.
    const usdOption = await screen.findByText(/USD/);
    fireEvent.click(usdOption);
    expect(onChange).toHaveBeenCalledWith("USD");
  });
});
