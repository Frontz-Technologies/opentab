// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FreeTextCombobox } from "../components/ui/free-text-combobox";

interface Opt {
  id: string;
  label: string;
}

const opts: Opt[] = [
  { id: "1", label: "Acme Coffee" },
  { id: "2", label: "Acme Tools" },
  { id: "3", label: "Beta Bakery" },
];

interface HarnessProps<T> {
  initialValue?: string;
  options: T[];
  onSelect?: (opt: T) => void;
  onChange?: (v: string) => void;
  maxResults?: number;
}

function Harness<T extends { id: string; label: string }>({
  initialValue = "",
  options,
  onSelect,
  onChange,
  maxResults,
}: HarnessProps<T>) {
  const [v, setV] = React.useState(initialValue);
  return (
    <FreeTextCombobox<T>
      value={v}
      onChange={(next) => {
        setV(next);
        onChange?.(next);
      }}
      onSelect={(o) => onSelect?.(o)}
      options={options}
      getKey={(o) => o.id}
      getLabel={(o) => o.label}
      maxResults={maxResults}
      placeholder="Type…"
    />
  );
}

describe("FreeTextCombobox", () => {
  it("filters options as the user types", () => {
    render(<Harness options={opts} />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "Acme" },
    });
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("calls onSelect AND onChange with the option label on click", () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    render(<Harness options={opts} onSelect={onSelect} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "Acme" },
    });
    fireEvent.mouseDown(screen.getByText("Acme Coffee"));
    expect(onSelect).toHaveBeenCalledWith(opts[0]);
    expect(onChange).toHaveBeenLastCalledWith("Acme Coffee");
  });

  it("keeps the typed value when the user types a no-match string", () => {
    const onChange = vi.fn();
    render(<Harness options={opts} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "NewVendor" },
    });
    expect(onChange).toHaveBeenLastCalledWith("NewVendor");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(
      (screen.getByPlaceholderText("Type…") as HTMLInputElement).value,
    ).toBe("NewVendor");
  });

  it("caps visible options at maxResults", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      label: `Match ${i}`,
    }));
    render(<Harness options={many} maxResults={8} />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "Match" },
    });
    expect(screen.getAllByRole("option")).toHaveLength(8);
  });
});
