import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: () => {
        throw new Error("db should not be touched");
      },
    },
  ),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/activities/record", () => ({ recordActivity: vi.fn() }));

import {
  uploadImportCsv,
  commitImport,
} from "@/app/(app)/import/[entity]/actions";

function ownerSession() {
  return {
    user: { id: "u1", email: "u1@e", role: "owner" },
    role: "owner",
    org: { id: "org-1", name: "Org", slug: "org" },
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opentab-import-action-"));
  process.env.UPLOADS_DIR = dir;
  delete process.env.S3_ENDPOINT;
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(ownerSession());
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.UPLOADS_DIR;
});

describe("uploadImportCsv", () => {
  it("returns headers, rowCount, and a 50-row capped sample", async () => {
    const lines = ["name,email"];
    for (let i = 0; i < 75; i++) {
      lines.push(`User ${i},u${i}@x.com`);
    }
    const fd = new FormData();
    fd.set(
      "file",
      new File([lines.join("\n")], "contacts.csv", { type: "text/csv" }),
    );

    const result = await uploadImportCsv(fd);

    if (!result.ok) throw new Error("expected ok");
    expect(result.parsed.headers).toEqual(["name", "email"]);
    expect(result.parsed.rowCount).toBe(75);
    expect(result.parsed.sample.length).toBe(50);
    expect(result.parsed.sample[0]).toEqual({
      name: "User 0",
      email: "u0@x.com",
    });
    expect(result.parsed.importId).toMatch(/^tmp_/);

    // The raw file landed under {orgId}/imports/tmp/{importId}.csv
    const onDisk = await readFile(
      join(dir, "org-1", "imports", "tmp", `${result.parsed.importId}.csv`),
    );
    expect(onDisk.toString().split("\n").length).toBe(76);
  });

  it("returns ok=false on parse error", async () => {
    const fd = new FormData();
    fd.set("file", new File([""], "empty.csv", { type: "text/csv" }));
    const result = await uploadImportCsv(fd);
    expect(result.ok).toBe(false);
  });

  it("returns ok=false when no file is supplied", async () => {
    const fd = new FormData();
    const result = await uploadImportCsv(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("No file supplied");
  });

  it("returns ok=false with 'Unauthorized' when there is no session", async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const fd = new FormData();
    fd.set("file", new File(["a,b\n1,2"], "x.csv", { type: "text/csv" }));
    const result = await uploadImportCsv(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Unauthorized");
  });

  it("returns ok=false with 'Forbidden' for a member role", async () => {
    getSessionMock.mockResolvedValueOnce({
      ...ownerSession(),
      user: { id: "u2", email: "u2@e", role: "member" },
      role: "member",
    });
    const fd = new FormData();
    fd.set("file", new File(["a,b\n1,2"], "x.csv", { type: "text/csv" }));
    const result = await uploadImportCsv(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Forbidden");
  });
});

// (Tests for commitImport happy paths require DB binding. The existing
// runner.test.ts already covers the post-validation insert pipeline
// against PGlite, so this test file focuses ONLY on the new behaviour
// commitImport added in Task 3: reading from storage and the missing-file
// branch.)

describe("commitImport — missing storage object", () => {
  it("returns ok=false 'Import session expired' when the file isn't in storage", async () => {
    // No upload happened first — pretend the cleanup processor swept the file.
    // The id passes the importId regex (valid uuid-v4 shape) so the request
    // reaches the storage check rather than the input validator.
    const result = await commitImport({
      entityKey: "contacts",
      importId: "tmp_00000000-0000-4000-8000-000000000000",
      mapping: {},
      skippedByUser: [],
      autoCreateToggles: {},
    });
    expect("ok" in result && result.ok).toBe(false);
    if ("error" in result) {
      expect(result.error).toMatch(/expired|re-upload/i);
    }
  });
});
