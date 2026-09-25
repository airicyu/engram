import { expect, test } from "bun:test";
import { attachmentsDir, chainFile, defaultPiModel, defaultPort, defaultStoreDirRel, memoriesDir, nodeFile, port, storeDir } from "./paths.ts";
import { readPool, readWorkspace, stampInTimezone } from "./store.ts";

test("store dir default is demo-engram-lite-data", () => {
  expect(defaultStoreDirRel).toBe("./demo-engram-lite-data");
  if (!process.env.ENGRAM_LITE_STORE_DIR) {
    const n = storeDir.replace(/\\/g, "/");
    expect(n.endsWith("/demo-engram-lite-data")).toBe(true);
  }
});

test("port from env or default", () => {
  expect(defaultPort).toBe(8797);
  if (!process.env.ENGRAM_LITE_PORT) {
    expect(port).toBe(8797);
  }
});

test("vault is memories/ under store", () => {
  expect(memoriesDir().replace(/\\/g, "/").endsWith("/memories")).toBe(true);
  expect(attachmentsDir().replace(/\\/g, "/").endsWith("/memories/_attachments/uploads")).toBe(true);
});

test("chain day path", () => {
  const p = chainFile("day", "2026-09-16");
  expect(p?.endsWith("memories/chain/days/2026-09/2026-09-16.md")).toBe(true);
  expect(chainFile("day", "nope")).toBeNull();
});

test("chain week path", () => {
  const p = chainFile("week", "2026-W30-0720");
  expect(p?.endsWith("memories/chain/weeks/2026-07/2026-W30-0720.md")).toBe(true);
  expect(chainFile("week", "2026-W30")).toBeNull();
});

test("node path", () => {
  expect(nodeFile("acme")?.endsWith("memories/nodes/acme/acme.md")).toBe(true);
  expect(nodeFile("../escape")).toBeNull();
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
