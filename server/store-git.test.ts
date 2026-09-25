import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { appendFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendPendingWithAttachments } from "./store.ts";
import {
  commitStore,
  ensureStoreGit,
  setStoreGitRunnerForTests,
} from "./store-git.ts";

function gitRevCount(storeDir: string): number {
  const r = spawnSync("git", ["rev-list", "--count", "HEAD"], {
    cwd: storeDir,
    encoding: "utf8",
  });
  if (r.status !== 0) return 0;
  return Number(r.stdout.trim()) || 0;
}

function gitLsFiles(storeDir: string): string[] {
  const r = spawnSync("git", ["ls-files"], { cwd: storeDir, encoding: "utf8" });
  expect(r.status).toBe(0);
  return r.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function scaffoldStore(root: string) {
  await mkdir(join(root, "memories", "pool"), { recursive: true });
  await writeFile(join(root, "memories", "pool", "pending.jsonl"), "", "utf8");
  await writeFile(join(root, "memories", "pool", "archived.jsonl"), "", "utf8");
  await writeFile(
    join(root, "workspace.yaml"),
    "timezone: Asia/Hong_Kong\nmemory_language: zh-Hant\n",
    "utf8",
  );
}

afterEach(() => {
  setStoreGitRunnerForTests(null);
});

test("store git: init on first commit and second write adds commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-sgit-"));
  try {
    await scaffoldStore(root);
    const vault = join(root, "memories");
    await expect(stat(join(root, ".git"))).rejects.toThrow();

    await appendPendingWithAttachments("虛構示範事件 A", null, vault);
    await commitStore(root, { op: "event", id: "evt_20260921_aaaaaa" });
    await stat(join(root, ".git"));
    expect(gitRevCount(root)).toBe(1);

    await appendPendingWithAttachments("虛構示範事件 B", null, vault);
    await commitStore(root, { op: "event", id: "evt_20260921_bbbbbb" });
    expect(gitRevCount(root)).toBe(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("store git: jobs/ ignored in git ls-files", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-sgit-jobs-"));
  try {
    await scaffoldStore(root);
    await mkdir(join(root, "jobs"), { recursive: true });
    await writeFile(join(root, "jobs", "job_test.json"), '{"id":"job_test"}\n', "utf8");
    await appendPendingWithAttachments("虛構 pool 行", null, join(root, "memories"));
    await commitStore(root, { op: "event", id: "evt_20260921_cccccc" });
    const tracked = gitLsFiles(root);
    expect(tracked.some((p) => p.startsWith("jobs/"))).toBe(false);
    const ignore = await readFile(join(root, ".gitignore"), "utf8");
    expect(ignore).toContain("jobs/");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("store git: merges existing gitignore without dropping user lines", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-sgit-merge-"));
  try {
    await writeFile(join(root, ".gitignore"), "custom-secret/\n", "utf8");
    await ensureStoreGit(root);
    const ignore = await readFile(join(root, ".gitignore"), "utf8");
    expect(ignore).toContain("custom-secret/");
    expect(ignore).toContain("jobs/");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("store git: git commit failure does not throw; vault write already done", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-sgit-fail-"));
  try {
    await scaffoldStore(root);
    const vault = join(root, "memories");
    const pending = join(vault, "pool", "pending.jsonl");
    await appendFile(pending, '{"id":"evt_stub","ts":"2026-09-21T00:00:00+08:00","raw":"虛構"}\n', "utf8");

    setStoreGitRunnerForTests((args, cwd) => {
      if (args[0] === "commit") {
        return { status: 1, stderr: "simulated commit failure" };
      }
      const r = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 30_000 });
      return { status: r.status ?? 1, stderr: `${r.stderr ?? ""}${r.stdout ?? ""}`.trim() };
    });

    await expect(commitStore(root, { op: "event", id: "evt_stub" })).resolves.toMatchObject({});
    const body = await readFile(pending, "utf8");
    expect(body).toContain("evt_stub");
  } finally {
    setStoreGitRunnerForTests(null);
    await rm(root, { recursive: true, force: true });
  }
});

test("store git: commit message prefix engram-lite", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-sgit-msg-"));
  try {
    await scaffoldStore(root);
    await commitStore(root, { op: "reset" });
    const r = spawnSync("git", ["log", "-1", "--format=%s"], { cwd: root, encoding: "utf8" });
    expect(r.stdout.trim()).toBe("engram-lite: reset");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("store git: POST /events handler path creates repo commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "engram-lite-sgit-http-"));
  const vault = join(root, "memories");
  try {
    await scaffoldStore(root);
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        if (req.method !== "POST" || new URL(req.url).pathname !== "/events") {
          return new Response("not found", { status: 404 });
        }
        const body = (await req.json()) as { raw?: string };
        const raw = body?.raw?.trim() ?? "";
        if (!raw) return Response.json({ error: "missing_raw" }, { status: 400 });
        const event = await appendPendingWithAttachments(raw, null, vault);
        await commitStore(root, { op: "event", id: event.id });
        return Response.json({ event }, { status: 200 });
      },
    });
    const res = await fetch(`http://127.0.0.1:${server.port}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: "虛構 HTTP 事件" }),
    });
    expect(res.status).toBe(200);
    server.stop();
    expect(gitRevCount(root)).toBe(1);
    const log = spawnSync("git", ["log", "-1", "--format=%s"], { cwd: root, encoding: "utf8" });
    expect(log.stdout.trim().startsWith("engram-lite: event evt_")).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
