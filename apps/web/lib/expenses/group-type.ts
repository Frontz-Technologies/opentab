import type { ExpenseGroupType } from "@opentab/db/schema";

// Client-side colour palette for the 4 accounting-classification types
// on `expense_groups.type` (#140). Each group's `typeColor` column
// overrides these; we default here so the column stays optional.
export const GROUP_TYPE_COLORS: Record<ExpenseGroupType, string> = {
  operating_expense: "#14b8a6", // teal
  purchase: "#f59e0b", // amber
  asset: "#8b5cf6", // purple
  other: "#6b7280", // gray
};

// Emoji marker for native <select> optgroup labels — the native select
// element doesn't support per-option colours via CSS, so we use a
// coloured emoji instead. Once we swap to a custom dropdown, drop this.
export const GROUP_TYPE_MARKER: Record<ExpenseGroupType, string> = {
  operating_expense: "🟢",
  purchase: "🟡",
  asset: "🟣",
  other: "⚪",
};
