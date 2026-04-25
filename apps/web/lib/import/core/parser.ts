import { parse } from "csv-parse/sync";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"];

// Heuristic delimiter sniff: pick the delimiter that produces the
// most consistent column count across the first 5 lines. Good enough
// for the well-formed exports our import targets — falls back to
// comma if no delimiter wins.
function sniffDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).filter(Boolean);
  if (sample.length === 0) return ",";
  let best = ",";
  let bestScore = -1;
  for (const d of CANDIDATE_DELIMITERS) {
    const counts = sample.map((line) => line.split(d).length);
    const max = Math.max(...counts);
    const consistent = counts.every((c) => c === max && c > 1);
    if (consistent && max > bestScore) {
      best = d;
      bestScore = max;
    }
  }
  return best;
}

// UTF-8 round-trip detection: decode as UTF-8, re-encode, compare
// against the input. If any byte differs the input is probably
// Windows-1252 / Latin-1 — decode that way instead.
function decode(buffer: Buffer): string {
  const utf8 = buffer.toString("utf-8");
  const re = Buffer.from(utf8, "utf-8");
  if (re.equals(buffer)) return utf8;
  return buffer.toString("latin1");
}

export async function parseCsv(buffer: Buffer): Promise<ParsedCsv> {
  if (buffer.length > MAX_BYTES) {
    throw new Error(
      `CSV too large: ${buffer.length} bytes > ${MAX_BYTES} (10MB cap)`,
    );
  }

  const text = decode(buffer).replace(/^﻿/, ""); // strip BOM
  if (text.trim().length === 0) {
    throw new Error("CSV has no header row");
  }

  const delimiter = sniffDelimiter(text);
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    delimiter,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (records.length > MAX_ROWS) {
    throw new Error(`CSV has ${records.length} rows, exceeds 5000-row cap`);
  }

  const headers =
    records.length > 0
      ? Object.keys(records[0])
      : text.split(/\r?\n/)[0].split(delimiter);
  return { headers, rows: records, delimiter };
}
