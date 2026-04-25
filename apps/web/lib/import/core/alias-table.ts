export type AliasMap = Record<string, string[]>;

function normalise(s: string): string {
  return s.trim().toLowerCase();
}

// Returns the canonical field name whose alias list contains a
// case-insensitive trim match for `header`, or null if none.
export function resolveHeader(
  header: string,
  aliases: AliasMap,
): string | null {
  const needle = normalise(header);
  for (const [canonical, alts] of Object.entries(aliases)) {
    if (alts.some((alt) => normalise(alt) === needle)) {
      return canonical;
    }
  }
  return null;
}
