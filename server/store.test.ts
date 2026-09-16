import { expect, test } from "bun:test";
import { chainFile, defaultPiModel, defaultStoreDirRel, nodeFile, storeDir } from "./paths.ts";
import { readPool, readWorkspace, stampInTimezone } from "./store.ts";

test("store dir default is sibling engram-lite-data", () => {
  expect(defaultStoreDirRel).toBe("./../engram-lite-data");
  if (!process.env.ENGRAM_LITE_STORE_DIR) {
    expect(storeDir.replace(/\\/g, "/").endsWith("/engram-lite-data")).toBe(true);
  }
});

test("chain day path", () => {
  const p = chainFile("day", "2026-09-16");
  expect(p?.endsWith("chain/days/2026-09/2026-09-16.md")).toBe(true);
  expect(chainFile("day", "nope")).toBeNull();
});

test("node path", () => {
  expect(nodeFile("acme")?.endsWith("nodes/acme/acme.md")).toBe(true);
  expect(nodeFile("Acme")).toBeNull();
});

test("read demo pool", async () => {
  const pool = await readPool();
  expect(Array.isArray(pool.pending)).toBe(true);
  expect(Array.isArray(pool.archived)).toBe(true);
});

test("stampInTimezone Hong Kong", () => {
  const { ts, ymd } = stampInTimezone("Asia/Hong_Kong", new Date("2026-09-16T12:00:00+08:00"));
  expect(ymd).toBe("20260916");
  expect(ts.startsWith("2026-09-16T")).toBe(true);
  expect(ts.includes("+08:00")).toBe(true);
});

test("pi_model default or workspace", async () => {
  const ws = await readWorkspace();
  expect(ws.pi_model.length).toBeGreaterThan(0);
  if (!process.env.ENGRAM_LITE_PI_MODEL && !process.env.PI_MODEL) {
    expect(ws.pi_model).toBe("deepseek/deepseek-v4.1-flash");
  }
  expect(defaultPiModel).toBe("deepseek/deepseek-v4.1-flash");
});
