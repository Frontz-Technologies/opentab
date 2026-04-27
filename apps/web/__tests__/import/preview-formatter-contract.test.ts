// Contract test: every field name referenced in the preview-formatter's
// PRIMARY/SECONDARY/AMOUNT tables MUST exist in the corresponding
// importer's `fields[].name` list. This catches the class of bug where
// the formatter was rewritten to use names like `vendorName` /
// `totalAmount` / `currency` that the actual importers never declared
// (review cards rendered "(empty row)" for every entity in production
// despite all unit tests being green).

import { describe, it, expect } from "vitest";
import { PREVIEW_FIELD_TABLES } from "@/lib/import/preview-formatter";
import { IMPORTERS } from "@/lib/import/importers";

const { PRIMARY_FIELDS, SECONDARY_FIELDS, AMOUNT_FIELDS } =
  PREVIEW_FIELD_TABLES;

describe("preview-formatter ↔ importer field-name contract", () => {
  for (const entityKey of Object.keys(IMPORTERS)) {
    const declared = new Set(IMPORTERS[entityKey].fields.map((f) => f.name));

    it(`${entityKey}: every PRIMARY_FIELDS name is declared by the importer`, () => {
      const referenced = PRIMARY_FIELDS[entityKey] ?? [];
      const missing = referenced.filter((name) => !declared.has(name));
      expect(
        missing,
        `[${entityKey}] PRIMARY_FIELDS missing from importer`,
      ).toEqual([]);
    });

    it(`${entityKey}: every SECONDARY_FIELDS name is declared by the importer`, () => {
      const referenced = SECONDARY_FIELDS[entityKey] ?? [];
      const missing = referenced.filter((name) => !declared.has(name));
      expect(
        missing,
        `[${entityKey}] SECONDARY_FIELDS missing from importer`,
      ).toEqual([]);
    });

    it(`${entityKey}: AMOUNT_FIELDS that the formatter pretty-prints exist on the importer if referenced`, () => {
      // Only enforce for amount names that ARE referenced for this entity
      // via PRIMARY/SECONDARY. The set is global, but we only need to
      // guarantee real-importer membership for names actually rendered.
      const referenced = [
        ...(PRIMARY_FIELDS[entityKey] ?? []),
        ...(SECONDARY_FIELDS[entityKey] ?? []),
      ].filter((name) => AMOUNT_FIELDS.has(name));
      const missing = referenced.filter((name) => !declared.has(name));
      expect(
        missing,
        `[${entityKey}] referenced AMOUNT_FIELDS missing from importer`,
      ).toEqual([]);
    });
  }

  it("contacts firstName + lastName fallback fields exist on the importer", () => {
    const declared = new Set(IMPORTERS.contacts.fields.map((f) => f.name));
    expect(declared.has("firstName")).toBe(true);
    expect(declared.has("lastName")).toBe(true);
  });

  it("currencyCode field exists on every entity that renders an amount", () => {
    for (const entityKey of Object.keys(IMPORTERS)) {
      const declared = new Set(IMPORTERS[entityKey].fields.map((f) => f.name));
      const rendersAmount = [
        ...(PRIMARY_FIELDS[entityKey] ?? []),
        ...(SECONDARY_FIELDS[entityKey] ?? []),
      ].some((name) => AMOUNT_FIELDS.has(name));
      if (!rendersAmount) continue;
      expect(
        declared.has("currencyCode"),
        `[${entityKey}] renders an amount but importer has no currencyCode`,
      ).toBe(true);
    }
  });
});
