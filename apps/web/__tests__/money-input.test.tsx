// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberFormatProvider } from "../components/providers/number-format-provider";
import { MoneyInput } from "../components/ui/money-input";

function Wrap(props: {
  format: "us" | "eu" | "fr";
  initial?: string;
  decimalScale?: 2 | 4;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = React.useState(props.initial ?? "");
  return (
    <NumberFormatProvider value={props.format}>
      <MoneyInput
        value={value}
        onChange={(next) => {
          setValue(next);
          props.onChange?.(next);
        }}
        decimalScale={props.decimalScale ?? 2}
        aria-label="amount"
      />
    </NumberFormatProvider>
  );
}

describe("MoneyInput (#281)", () => {
  it("us: pasting 1234.56 emits canonical 1234.56", () => {
    const onChange = vi.fn();
    render(<Wrap format="us" onChange={onChange} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234.56" } });
    expect(onChange).toHaveBeenLastCalledWith("1234.56");
  });

  it("eu: pasting 1234,56 emits canonical 1234.56", () => {
    const onChange = vi.fn();
    render(<Wrap format="eu" onChange={onChange} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234,56" } });
    expect(onChange).toHaveBeenLastCalledWith("1234.56");
  });

  it("fr: pasting 1234,56 emits canonical 1234.56", () => {
    const onChange = vi.fn();
    render(<Wrap format="fr" onChange={onChange} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1234,56" } });
    expect(onChange).toHaveBeenLastCalledWith("1234.56");
  });

  it("decimalScale=2 caps to 2 decimals", () => {
    const onChange = vi.fn();
    render(<Wrap format="us" onChange={onChange} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3.999" } });
    expect(onChange).toHaveBeenLastCalledWith("3.99");
  });

  it("decimalScale=4 allows 4 decimals", () => {
    const onChange = vi.fn();
    render(<Wrap format="us" decimalScale={4} onChange={onChange} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1.1234" } });
    expect(onChange).toHaveBeenLastCalledWith("1.1234");
  });

  it("rejects negative input by default", () => {
    const onChange = vi.fn();
    render(<Wrap format="us" onChange={onChange} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-5" } });
    expect(onChange).not.toHaveBeenCalledWith("-5");
  });

  it("us: pasting 1,234.56 (with thousand separator) emits canonical 1234.56", () => {
    const onChange = vi.fn();
    render(<Wrap format="us" onChange={onChange} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1,234.56" } });
    expect(onChange).toHaveBeenLastCalledWith("1234.56");
  });
});
