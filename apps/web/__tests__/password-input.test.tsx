// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PasswordInput } from "../components/ui/password-input";

const messages = {
  common: { showPassword: "Show password", hidePassword: "Hide password" },
};

function harness(props: React.ComponentProps<typeof PasswordInput> = {}) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <PasswordInput placeholder="pw" {...props} />
    </NextIntlClientProvider>
  );
}

describe("PasswordInput", () => {
  it("starts hidden (type=password)", () => {
    render(harness());
    const input = screen.getByPlaceholderText("pw") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("toggles to text when reveal button is clicked", () => {
    render(harness());
    const button = screen.getByRole("button", { name: /show password/i });
    fireEvent.click(button);
    const input = screen.getByPlaceholderText("pw") as HTMLInputElement;
    expect(input.type).toBe("text");
  });

  it("updates aria-label and aria-pressed on toggle", () => {
    render(harness());
    const button = screen.getByRole("button", { name: /show password/i });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /hide password/i })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /hide password/i })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
