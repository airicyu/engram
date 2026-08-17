/**
 * Higher-chain init/revise is summary-file existence only.
 * Run: `cd server && bun test src/store/memories/chain-higher-init.test.ts`
 */

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const serverRoot = join(import.meta.dir, "../../..");

describe("resolveHigherOperation", () => {
  test("revise only when summary file exists; yaml is ignored and dropped", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-higher-init-"));
    await mkdir(join(storeDir, "memories", "chain", "weeks", "2026-07"), { recursive: true });
    await writeFile(
      join(storeDir, "engram.workspace.yaml"),
      "timezone: Asia/Hong_Kong\nstore_version: 0.28.0\n",
      "utf8",
    );
    await writeFile(
      join(storeDir, "memories", "chain", "initialized_weeks.yaml"),
      "ids:\n  - 2026-W30-0720\n",
      "utf8",
    );
    await writeFile(
      join(storeDir, "memories", "chain", "weeks", "2026-07", "2026-W31-0727.summary.md"),
      "## Current\n\nweek\n",
      "utf8",
    );

    const script = `
      import { resolveHigherOperation, dropLegacyInitializedYaml } from "./src/store/memories/chain-higher.ts";
      import { join } from "node:path";
      const missingFile = await resolveHigherOperation("week", "2026-W30-0720");
      const hasFile = await resolveHigherOperation("week", "2026-W31-0727");
      const dropped = await dropLegacyInitializedYaml();
      const yamlGone = !(await Bun.file(join(process.env.ENGRAM_STORE_DIR!, "memories/chain/initialized_weeks.yaml")).exists());
      console.log(JSON.stringify({ missingFile, hasFile, dropped, yamlGone }));
    `;

    const proc = spawnSync("bun", ["-e", script], {
      cwd: serverRoot,
      env: { ...process.env, ENGRAM_STORE_DIR: storeDir },
      encoding: "utf8",
    });
    if (proc.status !== 0) {
      throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
    }
    const out = JSON.parse(proc.stdout.trim()) as {
      missingFile: string;
      hasFile: string;
      dropped: string[];
      yamlGone: boolean;
    };
    expect(out.missingFile).toBe("init");
    expect(out.hasFile).toBe("revise");
    expect(out.dropped).toContain("memories/chain/initialized_weeks.yaml");
    expect(out.yamlGone).toBe(true);
  });
});
