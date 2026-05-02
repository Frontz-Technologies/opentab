// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NumberFormatProvider } from "../components/providers/number-format-provider";
import { MoneyDisplay } from "../components/ui/money-display";

function renderWith(format: "us" | "eu" | "fr", node: React.ReactElement) {
  return render(
    <NumberFormatProvider value={format}>{node}</NumberFormatProvider>,
  );
}

describe("MoneyDisplay", () => {
  it("renders us format with EUR", () => {
    renderWith("us", <MoneyDisplay amount={1234.56} currencyCode="EUR" />);
    expect(screen.getByText(/1,234\.56/)).toBeDefined();
  });

  it("renders eu format with EUR", () => {
    renderWith("eu", <MoneyDisplay amount={1234.56} currencyCode="EUR" />);
    expect(screen.getByText(/1\.234,56/)).toBeDefined();
  });

  it("renders fr format with EUR (narrow no-break space thousand)", () => {
    renderWith("fr", <MoneyDisplay amount={1234.56} currencyCode="EUR" />);
    expect(screen.getByText(/1 234,56/)).toBeDefined();
  });

  it("renders 2 fraction digits for whole numbers", () => {
    renderWith("us", <MoneyDisplay amount={100} currencyCode="EUR" />);
    expect(screen.getByText(/100\.00/)).toBeDefined();
  });

  it("accepts a string amount and parses it", () => {
    renderWith("eu", <MoneyDisplay amount="1234.56" currencyCode="EUR" />);
    expect(screen.getByText(/1\.234,56/)).toBeDefined();
  });

  it("renders compact form for ≥10K", () => {
    renderWith(
      "us",
      <MoneyDisplay amount={12500} currencyCode="EUR" compact />,
    );
    expect(screen.getByText(/12\.5K|13K/)).toBeDefined();
  });

  it("falls back to em-dash for non-finite", () => {
    renderWith("us", <MoneyDisplay amount={Number.NaN} currencyCode="EUR" />);
    expect(screen.getByText("—")).toBeDefined();
  });

  it("right-aligns when align=right", () => {
    renderWith(
      "us",
      <MoneyDisplay
        amount={100}
        currencyCode="EUR"
        align="right"
        data-testid="md"
      />,
    );
    expect(screen.getByTestId("md").className).toContain("text-right");
  });
});
