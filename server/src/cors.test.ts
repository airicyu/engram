import { describe, expect, test } from "bun:test";
import { applyCors, corsPreflight, isLocalhostOrigin } from "./cors";

describe("cors localhost any port", () => {
  test("accepts localhost / 127.0.0.1 / ::1 with or without port", () => {
    expect(isLocalhostOrigin("http://localhost:3080")).toBe(true);
    expect(isLocalhostOrigin("http://localhost")).toBe(true);
    expect(isLocalhostOrigin("https://127.0.0.1:5173")).toBe(true);
    expect(isLocalhostOrigin("http://[::1]:8788")).toBe(true);
  });

  test("rejects non-local origins", () => {
    expect(isLocalhostOrigin("https://example.com")).toBe(false);
    expect(isLocalhostOrigin("http://192.168.1.2:3080")).toBe(false);
    expect(isLocalhostOrigin(null)).toBe(false);
  });

  test("applyCors reflects local Origin", () => {
    const req = new Request("http://127.0.0.1:8787/status", {
      headers: { Origin: "http://localhost:3080" },
    });
    const res = applyCors(req, Response.json({ ok: true }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3080");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  test("applyCors no-op for foreign Origin", () => {
    const req = new Request("http://127.0.0.1:8787/status", {
      headers: { Origin: "https://evil.example" },
    });
    const res = applyCors(req, Response.json({ ok: true }));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("preflight 204 for local Origin", () => {
    const req = new Request("http://127.0.0.1:8787/activities", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:9999",
        "Access-Control-Request-Method": "POST",
      },
    });
    const res = corsPreflight(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:9999");
  });
});
