import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseZoneFile, renderZoneFile, sweepFutureSight } from "./index.ts";

test("parse and render zone file", () => {
  const text = renderZoneFile(
    "upcoming",
    [
      {
        id: "fs-fixture-a",
        anchor_start: "2026-12-01",
        anchor_end: "2026-12-15",
        content: "虛構截止敘述",
      },
    ],
    "2026-09-01T00:00:00+08:00",
  );
  const parsed = parseZoneFile(text, "upcoming");
  expect(parsed).toHaveLength(1);
  expect(parsed[0]!.id).toBe("fs-fixture-a");
  expect(parsed[0]!.content).toBe("虛構截止敘述");
});

test("sweepFutureSight removes expired and appends pool lines", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-fs-"));
  const vault = join(root, "memories");
  await mkdir(join(vault, "pool"), { recursive: true });
  await mkdir(join(vault, "future-sight"), { recursive: true });
  await writeFile(join(vault, "pool", "pending.jsonl"), "", "utf8");
  await writeFile(join(vault, "pool", "archived.jsonl"), "", "utf8");
  await writeFile(join(root, "workspace.yaml"), "timezone: Asia/Hong_Kong\nmemory_language: zh-Hant\n", "utf8");

  const expired = renderZoneFile(
    "upcoming",
    [
      {
        id: "fs-past",
        anchor_start: "2020-01-01",
        anchor_end: "2020-01-02",
        content: "已過期虛構錨點",
      },
    ],
    "2026-09-01T00:00:00+08:00",
  );
  await writeFile(join(vault, "future-sight", "upcoming.md"), expired, "utf8");
  await writeFile(
    join(vault, "future-sight", "longTerm.md"),
    renderZoneFile("longTerm", [], "2026-09-01T00:00:00+08:00"),
    "utf8",
  );

  const appended: string[] = [];
  try {
    const result = await sweepFutureSight(async (raw) => {
      appended.push(raw);
    }, vault);
    expect(result.swept_expired).toEqual(["fs-past"]);
    expect(result.anchors).toHaveLength(0);
    expect(appended.length).toBe(1);
    expect(appended[0]).toContain("fs-past");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
