"use client";

import { Checkbox } from "@/components/ui/checkbox";

export interface FormCheckboxProps {
  id?: string;
  /** FormData field name. The hidden mirror emits this. */
  name: string;
  /** What to write to FormData when checked. Defaults to "on" (matches `formData.get(...) === "on"`). */
  checkedValue?: string;
  /** What to write to FormData when unchecked. Defaults to "" (so `=== "on"` is false). */
  uncheckedValue?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * Wraps `<Checkbox>` with a hidden `<input>` mirror so server actions reading
 * `FormData` continue to work. Centralises the boilerplate that previously had
 * to be repeated at every call site.
 */
export function FormCheckbox({
  id,
  name,
  checkedValue = "on",
  uncheckedValue = "",
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
  className,
}: FormCheckboxProps) {
  return (
    <>
      <input
        type="hidden"
        name={name}
        value={checked ? checkedValue : uncheckedValue}
      />
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={className}
      />
    </>
  );
}
