import type { ExpenseGroupType } from "@opentab/db/schema";

// Emoji marker for native <select> optgroup labels — the native select
// element doesn't support per-option colours via CSS, so we use a
// coloured emoji instead. Once we swap to a custom dropdown, drop this.
export const GROUP_TYPE_MARKER: Record<ExpenseGroupType, string> = {
  operating_expense: "🟢",
  purchase: "🟡",
  asset: "🟣",
  other: "⚪",
};
