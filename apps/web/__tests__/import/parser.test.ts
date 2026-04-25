import { describe, it, expect } from "vitest";
import { parseCsv } from "../../lib/import/core/parser";

describe("parseCsv (#215)", () => {
  it("parses a comma-delimited UTF-8 CSV with header row", async () => {
    const buffer = Buffer.from(
      "first_name,last_name,email\nAda,Lovelace,ada@example.com\nGrace,Hopper,grace@example.com\n",
      "utf-8",
    );
    const result = await parseCsv(buffer);
    expect(result.headers).toEqual(["first_name", "last_name", "email"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
    });
    expect(result.delimiter).toBe(",");
  });

  it("auto-detects semicolon delimiter (common in EU exports)", async () => {
    const buffer = Buffer.from("a;b;c\n1;2;3\n", "utf-8");
    const result = await parseCsv(buffer);
    expect(result.delimiter).toBe(";");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows[0]).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("auto-detects tab delimiter", async () => {
    const buffer = Buffer.from("a\tb\n1\t2\n", "utf-8");
    const result = await parseCsv(buffer);
    expect(result.delimiter).toBe("\t");
  });

  it("transcodes Windows-1252 to UTF-8", async () => {
    const buffer = Buffer.from([
      ...Buffer.from("name\n"),
      0x63,
      0x61,
      0x66,
      0xe9,
      0x0a,
    ]);
    const result = await parseCsv(buffer);
    expect(result.rows[0]).toEqual({ name: "café" });
  });

  it("throws when row count exceeds 5000", async () => {
    const lines = ["a,b"];
    for (let i = 0; i < 5001; i++) lines.push(`${i},${i}`);
    const buffer = Buffer.from(lines.join("\n"), "utf-8");
    await expect(parseCsv(buffer)).rejects.toThrow(/5000/);
  });

  it("throws when buffer exceeds 10MB", async () => {
    const buffer = Buffer.alloc(10 * 1024 * 1024 + 1);
    await expect(parseCsv(buffer)).rejects.toThrow(/10MB/);
  });

  it("throws on missing header row (empty file)", async () => {
    await expect(parseCsv(Buffer.from(""))).rejects.toThrow(/header/i);
  });
});
