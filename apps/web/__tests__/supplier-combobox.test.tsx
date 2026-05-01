// @vitest-environment jsdom
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SupplierCombobox,
  type SupplierContactOption,
} from "../components/expenses/supplier-combobox";

const contacts: SupplierContactOption[] = [
  {
    id: "1",
    displayName: "Acme Coffee",
    company: "Acme Coffee Ltd",
    vatNumber: "EL111",
    type: "supplier",
  },
  {
    id: "2",
    displayName: "Beta Bakery",
    company: null,
    vatNumber: "EL222",
    type: "supplier",
  },
  {
    id: "3",
    displayName: "Client Co",
    company: null,
    vatNumber: "EL333",
    type: "client",
  },
  {
    id: "4",
    displayName: "Both Co",
    company: null,
    vatNumber: "DE444",
    type: "both",
  },
];

interface HarnessProps {
  initialValue?: string;
  onSelect?: (c: SupplierContactOption) => void;
  onChange?: (v: string) => void;
}

function Harness({ initialValue = "", onSelect, onChange }: HarnessProps) {
  const [v, setV] = React.useState(initialValue);
  return (
    <SupplierCombobox
      value={v}
      onChange={(next) => {
        setV(next);
        onChange?.(next);
      }}
      onSelect={(c) => onSelect?.(c)}
      contacts={contacts}
      placeholder="Type…"
    />
  );
}

describe("SupplierCombobox", () => {
  it("filters by displayName substring", () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "acme" },
    });
    expect(screen.getByText("Acme Coffee")).toBeTruthy();
    expect(screen.queryByText("Beta Bakery")).toBeNull();
  });

  it("filters by company substring", () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "Coffee Ltd" },
    });
    expect(screen.getByText("Acme Coffee")).toBeTruthy();
  });

  it("filters by vatNumber substring", () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "DE444" },
    });
    expect(screen.getByText("Both Co")).toBeTruthy();
  });

  it("excludes contacts with type='client'", () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "Co" },
    });
    expect(screen.queryByText("Client Co")).toBeNull();
    expect(screen.getByText("Both Co")).toBeTruthy();
  });

  it("emits Contact on selection and updates input value to displayName", () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    render(<Harness onSelect={onSelect} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Type…"), {
      target: { value: "Acme" },
    });
    fireEvent.mouseDown(screen.getByText("Acme Coffee"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1" }),
    );
    expect(onChange).toHaveBeenLastCalledWith("Acme Coffee");
  });
});
