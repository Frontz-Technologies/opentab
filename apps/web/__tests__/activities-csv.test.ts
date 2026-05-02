import { describe, it, expect } from "vitest";
import { activitiesToCsv, type CsvActivityRow } from "../lib/activities/csv";

describe("activitiesToCsv — RFC-4180 serializer", () => {
  it("emits the header even when there are no rows", () => {
    const csv = activitiesToCsv([]);
    expect(csv).toBe(
      "timestamp_iso,actor_email,actor_kind,type,payload_json\r\n",
    );
  });

  it("emits one row per activity in the order given", () => {
    const rows: CsvActivityRow[] = [
      {
        createdAt: new Date("2026-04-25T13:00:00Z"),
        actorEmail: "owner@acme.io",
        type: "invoice.created",
        payload: { status: "DRAFT" },
      },
      {
        createdAt: new Date("2026-04-25T13:02:00Z"),
        actorEmail: "owner@acme.io",
        type: "invoice.sent",
        payload: { from: "PUBLISHED", to: "SENT" },
      },
    ];
    const csv = activitiesToCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "timestamp_iso,actor_email,actor_kind,type,payload_json",
    );
    expect(lines[1]).toBe(
      `2026-04-25T13:00:00.000Z,owner@acme.io,user,invoice.created,"{""status"":""DRAFT""}"`,
    );
    expect(lines[2]).toBe(
      `2026-04-25T13:02:00.000Z,owner@acme.io,user,invoice.sent,"{""from"":""PUBLISHED"",""to"":""SENT""}"`,
    );
  });

  it("renders system rows with empty actor_email + actor_kind=system", () => {
    const csv = activitiesToCsv([
      {
        createdAt: new Date("2026-04-25T13:02:01Z"),
        actorEmail: null,
        type: "mydata.submitted",
        payload: { kind: "mydata", externalId: "401-abc" },
      },
    ]);
    const line = csv.split("\r\n")[1];
    expect(line).toBe(
      `2026-04-25T13:02:01.000Z,,system,mydata.submitted,"{""kind"":""mydata"",""externalId"":""401-abc""}"`,
    );
  });

  it("escapes double-quotes in the payload JSON per RFC-4180 (double them)", () => {
    const csv = activitiesToCsv([
      {
        createdAt: new Date("2026-04-25T13:00:00Z"),
        actorEmail: "x@y.io",
        type: "invoice.cancelled",
        payload: { reason: 'client said "wrong amount"' },
      },
    ]);
    const line = csv.split("\r\n")[1];
    // Inner JSON: {"reason":"client said \"wrong amount\""}
    // CSV-quoted: every " becomes "" and the field is wrapped in "..."
    expect(line).toBe(
      `2026-04-25T13:00:00.000Z,x@y.io,user,invoice.cancelled,"{""reason"":""client said \\""wrong amount\\""""}"`,
    );
  });

  it("renders an empty cell for a null payload", () => {
    const csv = activitiesToCsv([
      {
        createdAt: new Date("2026-04-25T13:00:00Z"),
        actorEmail: "x@y.io",
        type: "invoice.deleted",
        payload: null,
      },
    ]);
    const line = csv.split("\r\n")[1];
    expect(line).toBe("2026-04-25T13:00:00.000Z,x@y.io,user,invoice.deleted,");
  });

  it("guards against CSV-injection on actor_email starting with a formula trigger", async () => {
    // actor_email with leading `=` `+` `-` `@` `\t` `\r` is
    // interpreted as a formula by Excel / Numbers / Sheets.
    // Prefix with `'` per OWASP.
    const csv = activitiesToCsv([
      {
        createdAt: new Date("2026-04-25T13:00:00Z"),
        actorEmail: "=cmd|/c calc!A0",
        type: "invoice.created",
        payload: null,
      },
      {
        createdAt: new Date("2026-04-25T13:01:00Z"),
        actorEmail: "+15551234567@example.com",
        type: "invoice.sent",
        payload: null,
      },
      {
        createdAt: new Date("2026-04-25T13:02:00Z"),
        actorEmail: "@notreal",
        type: "invoice.paid",
        payload: null,
      },
    ]);
    const lines = csv.split("\r\n");
    // The leading apostrophe must be present. Each field also gets
    // quoted because the apostrophe-prefixed value contains a `=` /
    // `+` / `@` followed by other content with `,` so quoting kicks
    // in as well — but the assertion is on the apostrophe.
    expect(lines[1]).toContain("'=cmd");
    expect(lines[2]).toContain("'+15551234567");
    expect(lines[3]).toContain("'@notreal");
  });

  it("does not prefix safe emails with an apostrophe", () => {
    const csv = activitiesToCsv([
      {
        createdAt: new Date("2026-04-25T13:00:00Z"),
        actorEmail: "owner@acme.io",
        type: "invoice.created",
        payload: null,
      },
    ]);
    const line = csv.split("\r\n")[1];
    expect(line).not.toContain("'owner");
    expect(line).toContain("owner@acme.io");
  });

  it("does not re-sort the rows (caller controls order)", () => {
    const rows: CsvActivityRow[] = [
      {
        createdAt: new Date("2026-04-25T13:02:00Z"),
        actorEmail: "x@y.io",
        type: "invoice.sent",
        payload: null,
      },
      {
        createdAt: new Date("2026-04-25T13:00:00Z"),
        actorEmail: "x@y.io",
        type: "invoice.created",
        payload: null,
      },
    ];
    const csv = activitiesToCsv(rows);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toContain("13:02:00");
    expect(lines[2]).toContain("13:00:00");
  });
});
