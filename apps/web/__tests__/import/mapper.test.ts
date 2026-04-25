import { describe, it, expect } from "vitest";
import { autoMap, applyOverrides } from "../../lib/import/core/mapper";

const aliases = {
  email: ["email", "e-mail"],
  firstName: ["first name", "first_name"],
  lastName: ["last name", "last_name"],
};

describe("autoMap (#215)", () => {
  it("auto-detects mappings via the alias table", () => {
    const result = autoMap(["First Name", "Last Name", "EMAIL"], aliases);
    expect(result).toEqual({
      "First Name": "firstName",
      "Last Name": "lastName",
      EMAIL: "email",
    });
  });

  it("leaves unknown headers as null (user must map or skip)", () => {
    const result = autoMap(["EMAIL", "phone"], aliases);
    expect(result).toEqual({ EMAIL: "email", phone: null });
  });
});

describe("applyOverrides (#215)", () => {
  it("user overrides take precedence over auto-mapped values", () => {
    const auto = { EMAIL: "email", "First Name": "firstName" };
    const overrides = { EMAIL: "lastName" };
    expect(applyOverrides(auto, overrides)).toEqual({
      EMAIL: "lastName",
      "First Name": "firstName",
    });
  });

  it("user can explicitly null a mapped header to skip the column", () => {
    const auto = { EMAIL: "email" };
    const overrides = { EMAIL: null };
    expect(applyOverrides(auto, overrides)).toEqual({ EMAIL: null });
  });
});
