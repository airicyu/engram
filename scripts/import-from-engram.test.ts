import { expect, test } from "bun:test";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { validateEventAttachments } from "../server/store.ts";
import { isValidWeekId } from "../server/chain-time.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runImport,
  targetVaultHasContent,
  looksLikeEngramStore,
} from "./import-from-engram.ts";

const fixtureFrom = join(import.meta.dir, "fixtures/import-engram-mini");

test("refuses import into Engram-shaped store", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-import-refuse-"));
  try {
    await Bun.write(join(root, "engram.workspace.yaml"), "timezone: Asia/Hong_Kong\n");
    await Bun.write(join(root, "dreams", ".gitkeep"), "");
    await expect(
      runImport({
        from: fixtureFrom,
        to: root,
        dryRun: false,
        force: false,
        scope: { chain: true, nodes: false, attachments: false, futureSight: false, pool: false, workspace: false },
      }),
    ).rejects.toThrow(/refusing --to/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("import fixture → lite store (chain, nodes, pool, workspace)", async () => {
  const to = await mkdtemp(join(tmpdir(), "engram-lite-import-ok-"));
  try {
    const stats = await runImport({
      from: fixtureFrom,
      to,
      dryRun: false,
      force: false,
      scope: {
        chain: true,
        nodes: true,
        attachments: false,
        futureSight: false,
        pool: true,
        workspace: true,
      },
    });
    expect(stats.chainWritten).toBe(2);
    expect(stats.poolRows).toBe(1);
    expect(stats.workspace).toBe(true);

    const day = await readFile(
      join(to, "memories/chain/days/2026-04/2026-04-01.md"),
      "utf8",
    );
    expect(day).toContain("虛構示範日");

    const week = await readFile(
      join(to, "memories/chain/weeks/2026-03/2026-W14-0330.md"),
      "utf8",
    );
    expect(week).toContain("虛構示範週");

    const node = await readFile(join(to, "memories/nodes/fict-a/fict-a.md"), "utf8");
    expect(node).toContain("虛構角色甲");

    const pending = await readFile(join(to, "memories/pool/pending.jsonl"), "utf8");
    expect(pending).toContain("evt_");
    expect(pending).toContain("虛構未沉澱事件甲");
    expect(pending).not.toContain("e9001");

    const poolRow = JSON.parse(pending.trim().split("\n")[0]!);
    const check = await validateEventAttachments(poolRow.raw, poolRow.attachments, join(to, "memories"));
    expect(check.ok).toBe(true);

    const ws = await readFile(join(to, "workspace.yaml"), "utf8");
    expect(ws).toContain("timezone: Asia/Hong_Kong");
    expect(ws).not.toContain("store_version");

    expect(await targetVaultHasContent(to)).toBe(true);
    expect(await looksLikeEngramStore(fixtureFrom)).toBe(true);
  } finally {
    await rm(to, { recursive: true, force: true });
  }
});

test("legacy YYYY-Www summary upgrades to YYYY-Www-MMDD path", async () => {
  const from = await mkdtemp(join(tmpdir(), "engram-lite-import-legacy-from-"));
  const to = await mkdtemp(join(tmpdir(), "engram-lite-import-legacy-to-"));
  try {
    await writeFile(join(from, "engram.workspace.yaml"), "timezone: Asia/Hong_Kong\n");
    const weekDir = join(from, "memories/chain/weeks/2026-03");
    await mkdir(weekDir, { recursive: true });
    await writeFile(
      join(weekDir, "2026-W14.summary.md"),
      "## 虛構 legacy 週\n僅測試檔名升級。\n",
      "utf8",
    );
    const stats = await runImport({
      from,
      to,
      dryRun: false,
      force: false,
      scope: {
        chain: true,
        nodes: false,
        attachments: false,
        futureSight: false,
        pool: false,
        workspace: false,
      },
    });
    expect(stats.chainWritten).toBe(1);
    const outDir = join(to, "memories/chain/weeks/2026-03");
    const files = await readdir(outDir);
    expect(files).toEqual(["2026-W14-0330.md"]);
    expect(isValidWeekId("2026-W14-0330")).toBe(true);
    const body = await readFile(join(outDir, "2026-W14-0330.md"), "utf8");
    expect(body).toContain("legacy");
  } finally {
    await rm(from, { recursive: true, force: true });
    await rm(to, { recursive: true, force: true });
  }
});

test("dry-run does not write files", async () => {
  const to = await mkdtemp(join(tmpdir(), "engram-lite-import-dry-"));
  try {
    await runImport({
      from: fixtureFrom,
      to,
      dryRun: true,
      force: false,
      scope: {
        chain: true,
        nodes: true,
        attachments: false,
        futureSight: false,
        pool: true,
        workspace: true,
      },
    });
    let err: unknown;
    try {
      await access(join(to, "memories/chain/days/2026-04/2026-04-01.md"));
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
  } finally {
    await rm(to, { recursive: true, force: true });
  }
});
