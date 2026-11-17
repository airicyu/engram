import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { missingDaysInSpan, poolLocalDates } from "./missing-days.ts";

test("pool dates skip bad timestamps and convert to the workspace zone", () => {
  const lines = [
    JSON.stringify({ ts: "2026-10-28T16:30:00Z" }),
    "not-json",
    JSON.stringify({ ts: "nope" }),
    JSON.stringify({ raw: "no ts" }),
  ];
  expect(poolLocalDates(lines, "Asia/Hong_Kong")).toEqual(["2026-10-29"]);
});

test("missing days are only the holes between the first and last pool date", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-miss-"));
  const mem = join(root, "memories");
  try {
    await mkdir(join(mem, "chain", "days", "2026-10"), { recursive: true });
    await writeFile(join(mem, "chain", "days", "2026-10", "2026-10-28.md"), "## 一日\n");
    await writeFile(join(mem, "chain", "days", "2026-10", "2026-10-30.md"), "## 一日\n");
    const dates = ["2026-10-28", "2026-10-30"];
    expect(await missingDaysInSpan(mem, dates)).toEqual(["2026-10-29"]);
    expect(await missingDaysInSpan(mem, [])).toEqual([]);
    await expect(readdir(join(mem, "clarify"))).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
