import { describe, it, expect } from "vitest";
import { activitiesToCsv, type CsvActivityRow } from "../lib/activities/csv";

describe("activitiesToCsv (#131) — RFC-4180 serializer", () => {
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
