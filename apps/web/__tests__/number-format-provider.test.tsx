// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  NumberFormatProvider,
  useNumberFormat,
} from "../components/providers/number-format-provider";

function Probe() {
  const fmt = useNumberFormat();
  return <span data-testid="fmt">{fmt}</span>;
}

describe("NumberFormatProvider", () => {
  it("renders the provided value", () => {
    render(
      <NumberFormatProvider value="fr">
        <Probe />
      </NumberFormatProvider>,
    );
    expect(screen.getByTestId("fmt").textContent).toBe("fr");
  });

  it("defaults to eu when no provider", () => {
    render(<Probe />);
    expect(screen.getByTestId("fmt").textContent).toBe("eu");
  });

  it("falls back to eu for invalid stored values", () => {
    render(
      <NumberFormatProvider value={"de" as unknown as "us"}>
        <Probe />
      </NumberFormatProvider>,
    );
    expect(screen.getByTestId("fmt").textContent).toBe("eu");
  });
});
