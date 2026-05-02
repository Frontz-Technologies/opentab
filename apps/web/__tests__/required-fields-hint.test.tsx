// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { RequiredFieldsHint } from "../components/forms/required-fields-hint";

describe("RequiredFieldsHint", () => {
  it("renders an asterisk and the i18n hint", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ common: { requiredFieldHint: "Required field" } }}
      >
        <RequiredFieldsHint />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Required field/i)).toBeTruthy();
    expect(screen.getByText("*")).toBeTruthy();
  });

  it("uses role=note for assistive tech", () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ common: { requiredFieldHint: "Required field" } }}
      >
        <RequiredFieldsHint />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("note")).toBeTruthy();
  });
});
