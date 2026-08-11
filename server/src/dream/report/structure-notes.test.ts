/**
 * Structure-notes soft lint unit tests (0.28).
 * Run: `cd server && bun test src/dream/report/structure-notes.test.ts`
 *
 * Lint helpers read `config.storeDir`; each case runs in a child process with
 * `ENGRAM_STORE_DIR` set so the parent test process is not mutated.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { standingUnderstandingMarkdown } from "../../store/memories/nodes";

const serverRoot = join(import.meta.dirname, "../../..");

function runLintInStore(storeDir: string, runId: string): string[] {
  const script = `
    import { lintDraftNodeStructure } from "./src/dream/report/structure-notes.ts";
    const warnings = await lintDraftNodeStructure(${JSON.stringify(runId)});
    console.log(JSON.stringify(warnings));
  `;
  const proc = spawnSync("bun", ["-e", script], {
    cwd: serverRoot,
    env: { ...process.env, ENGRAM_STORE_DIR: storeDir },
    encoding: "utf8",
  });
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
  }
  return JSON.parse(proc.stdout.trim()) as string[];
}

describe("structure-notes", () => {
  test("empty warnings → _None_", async () => {
    const { formatStructureNotesSection } = await import("./structure-notes");
    expect(formatStructureNotesSection([])).toBe("## Structure notes\n\n_None_");
  });

  test("missing headings and broken link produce warnings", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-struct-"));
    await writeFile(
      join(storeDir, "engram.workspace.yaml"),
      "timezone: Asia/Hong_Kong\nstore_version: 0.28.0\n",
      "utf8",
    );
    const runId = "dream-struct-1";
    const nodeDir = join(storeDir, "dreams", "draft", runId, "memories", "nodes", "eric");
    await mkdir(nodeDir, { recursive: true });
    await mkdir(join(storeDir, "memories", "nodes"), { recursive: true });
    await writeFile(
      join(nodeDir, "eric.md"),
      [
        "## Identity",
        "",
        "Person",
        "",
        "## Relation",
        "",
        "Works with mak and [[nodes/ghost/ghost|ghost]]",
        "",
        // missing Standing facts + Current situation
      ].join("\n"),
      "utf8",
    );
    await mkdir(join(storeDir, "memories", "nodes", "mak"), { recursive: true });
    await writeFile(
      join(storeDir, "memories", "nodes", "mak", "mak.md"),
      standingUnderstandingMarkdown({ identity: "Mak" }),
      "utf8",
    );

    const warnings = runLintInStore(storeDir, runId);
    expect(warnings.some((w) => w.includes("missing heading Standing facts"))).toBe(true);
    expect(warnings.some((w) => w.includes("missing heading Current situation"))).toBe(true);
    expect(warnings.some((w) => w.includes("Relation mentions mak without wikilink"))).toBe(
      true,
    );
    expect(warnings.some((w) => w.includes("broken link nodes/ghost/ghost"))).toBe(true);
  });

  test("good skeleton with wikilink → no warnings", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-struct-ok-"));
    await writeFile(
      join(storeDir, "engram.workspace.yaml"),
      "timezone: Asia/Hong_Kong\nstore_version: 0.28.0\n",
      "utf8",
    );
    const runId = "dream-struct-ok";
    await mkdir(join(storeDir, "memories", "nodes", "mak"), { recursive: true });
    await writeFile(
      join(storeDir, "memories", "nodes", "mak", "mak.md"),
      standingUnderstandingMarkdown({ identity: "Mak" }),
      "utf8",
    );
    const nodeDir = join(storeDir, "dreams", "draft", runId, "memories", "nodes", "eric");
    await mkdir(nodeDir, { recursive: true });
    await writeFile(
      join(nodeDir, "eric.md"),
      standingUnderstandingMarkdown({
        identity: "Eric",
        relation: `Colleague of [[nodes/mak/mak|mak]]`,
      }),
      "utf8",
    );

    const warnings = runLintInStore(storeDir, runId);
    expect(warnings).toEqual([]);
  });

  test("summary mentions peer without [[ → warning", async () => {
    const storeDir = await mkdtemp(join(tmpdir(), "engram-struct-sum-"));
    await writeFile(
      join(storeDir, "engram.workspace.yaml"),
      "timezone: Asia/Hong_Kong\nstore_version: 0.28.0\n",
      "utf8",
    );
    const runId = "dream-struct-sum";
    await mkdir(join(storeDir, "memories", "nodes", "mak"), { recursive: true });
    await writeFile(
      join(storeDir, "memories", "nodes", "mak", "mak.md"),
      standingUnderstandingMarkdown({ identity: "Mak" }),
      "utf8",
    );
    const sumDir = join(
      storeDir,
      "dreams",
      "draft",
      runId,
      "memories",
      "chain",
      "days",
      "2026-07",
    );
    await mkdir(sumDir, { recursive: true });
    await writeFile(
      join(sumDir, "2026-07-23.summary.md"),
      "Talked with mak about the wedding.\n",
      "utf8",
    );

    const script = `
      import { lintDraftChainSummaries } from "./src/dream/report/structure-notes.ts";
      const warnings = await lintDraftChainSummaries(${JSON.stringify(runId)});
      console.log(JSON.stringify(warnings));
    `;
    const { spawnSync } = await import("node:child_process");
    const proc = spawnSync("bun", ["-e", script], {
      cwd: serverRoot,
      env: { ...process.env, ENGRAM_STORE_DIR: storeDir },
      encoding: "utf8",
    });
    if (proc.status !== 0) {
      throw new Error(proc.stderr || proc.stdout || `exit ${proc.status}`);
    }
    const warnings = JSON.parse(proc.stdout.trim()) as string[];
    expect(
      warnings.some((w) => w.includes("mentions mak without wikilink")),
    ).toBe(true);
  });
});
