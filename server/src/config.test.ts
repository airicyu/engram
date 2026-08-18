/**
 * Unified config resolution (workspace yaml → env → default).
 * Run: cd server && bun test src/config.test.ts
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const serverRoot = join(import.meta.dir, "..");

type ConfigSnapshot = {
  port: number;
  agentMode: string;
  tempDir: string;
  allowStaleStore: boolean;
  dreamDebug: boolean;
  dreamAutoApprove: boolean;
};

function loadConfig(storeDir: string, extraEnv: Record<string, string> = {}): ConfigSnapshot {
  const script = `
    import { config } from "./src/config.ts";
    console.log(JSON.stringify({
      port: config.port,
      agentMode: config.agentMode,
      tempDir: config.tempDir,
      allowStaleStore: config.allowStaleStore,
      dreamDebug: config.dreamDebug,
      dreamAutoApprove: config.dreamAutoApprove,
    }));
  `;
  const proc = spawnSync("bun", ["-e", script], {
    cwd: serverRoot,
    env: { ...process.env, ENGRAM_STORE_DIR: storeDir, ...extraEnv },
    encoding: "utf8",
  });
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.stdout || `config load exit ${proc.status}`);
  }
  return JSON.parse(proc.stdout.trim()) as ConfigSnapshot;
}

async function withWorkspace(
  yaml: string,
  fn: (storeDir: string) => void | Promise<void>,
): Promise<void> {
  const storeDir = await mkdtemp(join(tmpdir(), "engram-config-"));
  await writeFile(join(storeDir, "engram.workspace.yaml"), yaml, "utf8");
  await fn(storeDir);
}

describe("unified config", () => {
  test("workspace port wins over PORT env", async () => {
    await withWorkspace(
      "timezone: Asia/Hong_Kong\nstore_version: 0.20.0\nport: 9999\n",
      (storeDir) => {
        const c = loadConfig(storeDir, { PORT: "8888" });
        expect(c.port).toBe(9999);
      },
    );
  });

  test("PORT env used when workspace omits port", async () => {
    await withWorkspace("timezone: Asia/Hong_Kong\nstore_version: 0.20.0\n", (storeDir) => {
      const c = loadConfig(storeDir, { PORT: "8888" });
      expect(c.port).toBe(8888);
    });
  });

  test("workspace agent wins over ENGRAM_AGENT env", async () => {
    await withWorkspace(
      "timezone: Asia/Hong_Kong\nstore_version: 0.20.0\nagent: cursor\n",
      (storeDir) => {
        const c = loadConfig(storeDir, { ENGRAM_AGENT: "claude" });
        expect(c.agentMode).toBe("cursor");
      },
    );
  });

  test("ENGRAM_AGENT=codex resolves", async () => {
    await withWorkspace("timezone: Asia/Hong_Kong\nstore_version: 0.20.0\n", (storeDir) => {
      const c = loadConfig(storeDir, { ENGRAM_AGENT: "codex" });
      expect(c.agentMode).toBe("codex");
    });
  });

  test("allow_stale_store from workspace yaml", async () => {
    await withWorkspace(
      "timezone: Asia/Hong_Kong\nstore_version: 0.20.0\nallow_stale_store: true\n",
      (storeDir) => {
        const c = loadConfig(storeDir, { ENGRAM_ALLOW_STALE_STORE: "0" });
        expect(c.allowStaleStore).toBe(true);
      },
    );
  });

  test("dream_debug from env when workspace omits key", async () => {
    await withWorkspace("timezone: Asia/Hong_Kong\nstore_version: 0.20.0\n", (storeDir) => {
      const c = loadConfig(storeDir, { ENGRAM_DREAM_DEBUG: "1" });
      expect(c.dreamDebug).toBe(true);
    });
  });

  test("dream_auto_approve defaults true when omitted", async () => {
    await withWorkspace("timezone: Asia/Hong_Kong\nstore_version: 0.36.0\n", (storeDir) => {
      const c = loadConfig(storeDir, { ENGRAM_DREAM_AUTO_APPROVE: "" });
      expect(c.dreamAutoApprove).toBe(true);
    });
  });

  test("ENGRAM_DREAM_AUTO_APPROVE=0 when workspace omits key", async () => {
    await withWorkspace("timezone: Asia/Hong_Kong\nstore_version: 0.36.0\n", (storeDir) => {
      const c = loadConfig(storeDir, { ENGRAM_DREAM_AUTO_APPROVE: "0" });
      expect(c.dreamAutoApprove).toBe(false);
    });
  });

  test("workspace dream_auto_approve false wins over env", async () => {
    await withWorkspace(
      "timezone: Asia/Hong_Kong\nstore_version: 0.36.0\ndream_auto_approve: false\n",
      (storeDir) => {
        const c = loadConfig(storeDir, { ENGRAM_DREAM_AUTO_APPROVE: "1" });
        expect(c.dreamAutoApprove).toBe(false);
      },
    );
  });
});
