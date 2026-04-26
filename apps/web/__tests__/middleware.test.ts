import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function makeRequest(pathname: string, withSession = false): NextRequest {
  const url = new URL(`https://opentab.test${pathname}`);
  const headers = new Headers();
  if (withSession) {
    headers.set("cookie", "better-auth.session_token=fake");
  }
  return new NextRequest(url, { headers });
}

describe("middleware publicPaths", () => {
  it("passes /api/healthz through without redirect when unauthenticated", () => {
    const res = middleware(makeRequest("/api/healthz"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes /legal through without redirect when unauthenticated", () => {
    const res = middleware(makeRequest("/legal"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still redirects unauthenticated app routes to /login", () => {
    const res = middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("lets authenticated app routes through", () => {
    const res = middleware(makeRequest("/dashboard", true));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
