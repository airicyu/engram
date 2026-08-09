/**
 * Ledger append sidecars must apply once (finalize is called twice per dream).
 * Run: `cd server && bun test src/store/dreams/file-pipeline.test.ts`
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const serverRoot = join(import.meta.dir, "../../..");

describe("applyAppendSidecars idempotency", () => {
  test("second finalize does not duplicate day ledger blocks", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-append-"));
    await writeFile(
      join(storeDir, "engram.workspace.yaml"),
      "timezone: Asia/Hong_Kong\nstore_version: 0.20.0\n",
      "utf8",
    );
    const dreamRunId = "dream-append-test-1";
    const ledgerRel = "memories/chain/days/2026-08/2026-08-06.md";
    const block = `<!-- patch:p001 -->
### patch:p001 · events:[e1]

once
`;

    const script = `
      import { mkdir, writeFile } from "node:fs/promises";
      import { dirname, join } from "node:path";
      import {
        prepareDreamDraft,
        finalizeDraftFromDisk,
        draftAbs,
      } from "./src/store/dreams/file-pipeline.ts";

      const dreamRunId = ${JSON.stringify(dreamRunId)};
      const ledgerRel = ${JSON.stringify(ledgerRel)};
      const block = ${JSON.stringify(block)};

      await prepareDreamDraft(dreamRunId);
      const sidecar = draftAbs(dreamRunId, "appends", ...ledgerRel.split("/"));
      await mkdir(dirname(sidecar), { recursive: true });
      await writeFile(sidecar, block, "utf8");

      await finalizeDraftFromDisk(dreamRunId);
      await finalizeDraftFromDisk(dreamRunId);

      const draftLedger = draftAbs(dreamRunId, ...ledgerRel.split("/"));
      const text = await Bun.file(draftLedger).text();
      const sidecarGone = !(await Bun.file(sidecar).exists());
      console.log(JSON.stringify({ text, sidecarGone }));
    `;

    const proc = spawnSync("bun", ["-e", script], {
      cwd: serverRoot,
      env: { ...process.env, ENGRAM_STORE_DIR: storeDir },
      encoding: "utf8",
    });
    if (proc.status !== 0) {
      throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
    }
    const { text, sidecarGone } = JSON.parse(proc.stdout.trim()) as {
      text: string;
      sidecarGone: boolean;
    };

    expect(sidecarGone).toBe(true);
    expect(text).toContain("<!-- patch:p001 -->");
    expect(text).toContain("once");
    const matches = text.match(/<!-- patch:p001 -->/g) ?? [];
    expect(matches.length).toBe(1);
  });

  test("0.28 finalize omits legacy understand/what.md from manifest", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-legacy-fin-"));
    await writeFile(
      join(storeDir, "engram.workspace.yaml"),
      "timezone: Asia/Hong_Kong\nstore_version: 0.28.0\n",
      "utf8",
    );
    const dreamRunId = "dream-legacy-fin-1";

    const script = `
      import { mkdir, writeFile, access } from "node:fs/promises";
      import { join } from "node:path";
      import {
        prepareDreamDraft,
        finalizeDraftFromDisk,
        draftAbs,
      } from "./src/store/dreams/file-pipeline.ts";
      import { readManifest } from "./src/store/dreams/draft.ts";
      import { standingUnderstandingMarkdown } from "./src/store/memories/nodes.ts";

      const dreamRunId = ${JSON.stringify(dreamRunId)};
      await prepareDreamDraft(dreamRunId);
      const goodRel = "memories/nodes/acme/acme.md";
      const badRel = "memories/nodes/acme/understand/what.md";
      const indexRel = "memories/nodes/acme/INDEX.md";
      await mkdir(draftAbs(dreamRunId, "memories", "nodes", "acme", "understand"), { recursive: true });
      await writeFile(
        draftAbs(dreamRunId, ...goodRel.split("/")),
        standingUnderstandingMarkdown({ identity: "Acme" }),
        "utf8",
      );
      await writeFile(draftAbs(dreamRunId, ...badRel.split("/")), "LEGACY\\n", "utf8");
      await writeFile(draftAbs(dreamRunId, ...indexRel.split("/")), "# acme\\n\\nSee understand/what.md\\n", "utf8");

      const manifest = await finalizeDraftFromDisk(dreamRunId);
      const paths = manifest.entries.map((e) => e.path);
      const legacyGone = await access(draftAbs(dreamRunId, ...badRel.split("/"))).then(() => false).catch(() => true);
      const indexGone = await access(draftAbs(dreamRunId, ...indexRel.split("/"))).then(() => false).catch(() => true);
      console.log(JSON.stringify({ paths, legacyGone, indexGone }));
    `;

    const proc = spawnSync("bun", ["-e", script], {
      cwd: serverRoot,
      env: { ...process.env, ENGRAM_STORE_DIR: storeDir },
      encoding: "utf8",
    });
    if (proc.status !== 0) {
      throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
    }
    const { paths, legacyGone, indexGone } = JSON.parse(proc.stdout.trim()) as {
      paths: string[];
      legacyGone: boolean;
      indexGone: boolean;
    };
    expect(paths).toContain("memories/nodes/acme/acme.md");
    expect(paths.some((p) => p.includes("understand/what.md"))).toBe(false);
    expect(paths.some((p) => /INDEX\.md$/i.test(p))).toBe(false);
    expect(legacyGone).toBe(true);
    expect(indexGone).toBe(true);
  });
});
