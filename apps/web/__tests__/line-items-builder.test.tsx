// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "../messages/en.json";
import { LineItemsBuilder } from "../components/invoicing/line-items-builder";

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {ui}
  </NextIntlClientProvider>
);

describe("LineItemsBuilder showDescription", () => {
  const baseProps = {
    items: [
      {
        id: "1",
        productId: "",
        sortOrder: 0,
        name: "Widget",
        description: "Big widget",
        quantity: "1",
        unitPrice: "10",
        unit: "",
        taxCategory: "standard",
        taxRate: "24",
        taxAmount: "2.40",
        lineTotal: "12.40",
      },
    ],
    onChange: () => {},
    products: [] as never[],
    defaultTaxRate: "24",
    usesInclusiveTax: false,
  };

  it("renders the description input by default", () => {
    render(wrap(<LineItemsBuilder {...baseProps} />));
    expect(screen.getByPlaceholderText(/Description/i)).toBeTruthy();
  });

  it("hides the description input when showDescription is false", () => {
    render(wrap(<LineItemsBuilder {...baseProps} showDescription={false} />));
    expect(screen.queryByPlaceholderText(/Description/i)).toBeNull();
  });
});
