// Per-invoice activity CSV serializer (#131). Output is RFC-4180:
// CRLF line endings, header row, fields containing `,` `"` `\r` `\n`
// are wrapped in double-quotes with internal `"` doubled to `""`.

export interface CsvActivityRow {
  createdAt: Date;
  actorEmail: string | null;
  type: string;
  payload: Record<string, unknown> | null;
}

const HEADER = "timestamp_iso,actor_email,actor_kind,type,payload_json";

function csvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
