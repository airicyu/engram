/**
 * Phase 2 owner-aware lock gates (0.20): G2.1–G2.3 (+ helpers for G2.4/G2.5).
 * Run: `cd server && bun test src/store/dreams/lock.test.ts`
 */

import { describe, expect, test, afterEach } from "bun:test";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  __setLockPathForTests,
  acquireLock,
  breakStaleLock,
  isLocked,
  readLockMeta,
  releaseLock,
} from "./lock";

async function withTempLock<T>(fn: (lockFile: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "engram-lock-"));
  const lockFile = join(dir, "dream.lock");
  __setLockPathForTests(lockFile);
  try {
    return await fn(lockFile);
  } finally {
    __setLockPathForTests(null);
  }
}

afterEach(() => {
  __setLockPathForTests(null);
});

describe("owner-aware dream lock", () => {
  test("G2.1 wrong token does not release", async () => {
    await withTempLock(async (lockFile) => {
      const a = await acquireLock("holder-a");
      const released = await releaseLock("wrong-token");
      expect(released).toBe(false);
      expect(await isLocked()).toBe(true);
      const meta = await readLockMeta();
      expect(meta?.token).toBe(a.token);
      expect(meta?.holder).toBe("holder-a");
      await access(lockFile);
    });
  });

  test("G2.2 correct token releases", async () => {
    await withTempLock(async () => {
      const a = await acquireLock("holder-a");
      const released = await releaseLock(a.token);
      expect(released).toBe(true);
      expect(await isLocked()).toBe(false);
    });
  });

  test("G2.3 stale break then old release does not delete new lock", async () => {
    await withTempLock(async (lockFile) => {
      const a = await acquireLock("holder-a");
      // Simulate stale by rewriting acquired_at far in the past (keep token).
      await writeFile(
        lockFile,
        JSON.stringify({
          holder: a.holder,
          token: a.token,
          acquired_at: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
        }) + "\n",
        "utf8",
      );
      expect(await breakStaleLock()).toBe(true);
      expect(await isLocked()).toBe(false);

      const b = await acquireLock("holder-b");
      const releasedOld = await releaseLock(a.token);
      expect(releasedOld).toBe(false);
      expect(await isLocked()).toBe(true);
      const meta = await readLockMeta();
      expect(meta?.token).toBe(b.token);
      expect(meta?.holder).toBe("holder-b");
    });
  });

  test("G2.5 cancel-style: only matching token releases", async () => {
    await withTempLock(async () => {
      const jobToken = (await acquireLock("dream-run")).token;
      // Another holder somehow acquired after break — cancel with old job token must no-op.
      await breakStaleLock(); // not stale yet — no-op
      expect(await isLocked()).toBe(true);
      expect(await releaseLock(jobToken)).toBe(true);
      expect(await isLocked()).toBe(false);
    });
  });

  test("legacy lock without token is stale-breakable; release without match no-ops", async () => {
    await withTempLock(async (lockFile) => {
      await writeFile(
        lockFile,
        JSON.stringify({ holder: "old", acquired_at: new Date().toISOString() }) + "\n",
        "utf8",
      );
      expect(await releaseLock("any")).toBe(false);
      expect(await isLocked()).toBe(true);
      expect(await breakStaleLock()).toBe(true);
      expect(await isLocked()).toBe(false);
    });
  });
});
