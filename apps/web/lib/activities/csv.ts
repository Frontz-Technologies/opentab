// Per-invoice activity CSV serializer. Output is RFC-4180: CRLF line
// endings, header row, fields containing `,` `"` `\r` `\n` are
// wrapped in double-quotes with internal `"` doubled to `""`.

export interface CsvActivityRow {
  createdAt: Date;
  actorEmail: string | null;
  type: string;
  payload: Record<string, unknown> | null;
}

const HEADER = "timestamp_iso,actor_email,actor_kind,type,payload_json";

// CSV-injection guard (OWASP). Excel / Numbers / Sheets interpret a
// field whose first character is one of `= + - @ \t \r` as a
// formula on import (e.g. `=HYPERLINK(...)`, `=cmd|...!A0`). The
// audit CSV's `actor_email` is verbatim DB content, so a hostile or
// accidentally-malformed email like `+15551234567@…` could fire on
// open. Prefix such fields with a single apostrophe — the apostrophe
// is consumed by the spreadsheet parser as a string-literal marker
// and doesn't appear in the rendered cell. Other rendering paths
// (text editors, jq, custom parsers) see the apostrophe as part of
// the value, which is the conservative trade-off vs. arbitrary code
// execution on open.
function csvField(value: string): string {
  let v = value;
  if (v.length > 0 && /^[=+\-@\t\r]/.test(v)) {
    v = "'" + v;
  }
  if (
    v.includes(",") ||
    v.includes('"') ||
    v.includes("\r") ||
    v.includes("\n")
  ) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function activitiesToCsv(rows: CsvActivityRow[]): string {
  const lines = [HEADER];
  for (const row of rows) {
    const timestampIso = row.createdAt.toISOString();
    const actorEmail = row.actorEmail ?? "";
    const actorKind = row.actorEmail === null ? "system" : "user";
    const payloadJson = row.payload === null ? "" : JSON.stringify(row.payload);
    lines.push(
      [
        csvField(timestampIso),
        csvField(actorEmail),
        csvField(actorKind),
        csvField(row.type),
        csvField(payloadJson),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
