import type { AliasMap } from "./alias-table";
import { resolveHeader } from "./alias-table";

export type Mapping = Record<string, string | null>;

// Pure: given the header row from a parsed CSV and the descriptor's
// alias table, return a header → canonical-field map. Unknown headers
// map to null (the wizard's Map step shows them with a "Skip / pick
// one" dropdown). Match is case-insensitive trim per resolveHeader.
export function autoMap(headers: string[], aliases: AliasMap): Mapping {
  const out: Mapping = {};
  for (const h of headers) out[h] = resolveHeader(h, aliases);
  return out;
}

// Merge user overrides on top of the auto-mapped result. Override of
// `null` is meaningful — user is explicitly skipping that column.
export function applyOverrides(auto: Mapping, overrides: Mapping): Mapping {
  return { ...auto, ...overrides };
}
