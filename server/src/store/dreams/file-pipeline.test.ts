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
});
