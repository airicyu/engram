/** File-based mutual exclusion for dream extraction and commit operations (0.20 owner token). */

import { randomUUID } from "node:crypto";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { homePath } from "../home";

const STALE_LOCK_MS = 30 * 60 * 1000; // 30 minutes

/** Test-only override for lock file path (unit tests). */
let lockPathOverride: string | null = null;

/** @internal — Phase 2 lock unit tests only. */
export function __setLockPathForTests(path: string | null): void {
  lockPathOverride = path;
}

/**
 * Metadata persisted while a dream lock is held.
 * 0.20: `token` is required for release. Locks without `token` (pre-0.20) are
 * treated as breakable when stale; `releaseLock` will not delete them without a match.
 */
export interface LockMeta {
  holder: string;
  /** Unique lease id for this acquire; release must present the same value. */
  token: string;
  acquired_at: string;
}

function lockPath(): string {
  return lockPathOverride ?? homePath("dreams", "dream.lock");
}

/** Return whether the dream lock file exists. */
export async function isLocked(): Promise<boolean> {
  try {
    await access(lockPath());
    return true;
  } catch {
    return false;
  }
}

/** Read lock metadata, or null when it is unavailable. */
export async function readLockMeta(): Promise<LockMeta | null> {
  try {
    const raw = await readFile(lockPath(), "utf8");
    const data = JSON.parse(raw) as Partial<LockMeta>;
    if (!data || typeof data.holder !== "string" || typeof data.acquired_at !== "string") {
      return null;
    }
    return {
      holder: data.holder,
      token: typeof data.token === "string" ? data.token : "",
      acquired_at: data.acquired_at,
    };
  } catch {
    return null;
  }
}

/** Return whether the current lock has exceeded its allowed lifetime. */
export async function isLockStale(): Promise<boolean> {
  const meta = await readLockMeta();
  if (!meta) return false;
  // Pre-0.20 locks without token: treat as stale-eligible so break can clear them.
  if (!meta.token) return true;
  const acquired = new Date(meta.acquired_at).getTime();
  return Date.now() - acquired > STALE_LOCK_MS;
}

/** Remove the lock only when it is stale (or token-less legacy). Returns whether deleted. */
export async function breakStaleLock(): Promise<boolean> {
  if (await isLockStale()) {
    try {
      await unlink(lockPath());
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Acquire the exclusive dream lock for a named holder; returns meta including token. */
export async function acquireLock(holder: string): Promise<LockMeta> {
  if (await isLocked()) {
    throw new LockError("dream.lock already held");
  }
  const meta: LockMeta = {
    holder,
    token: randomUUID(),
    acquired_at: new Date().toISOString(),
  };
  await writeFile(lockPath(), JSON.stringify(meta) + "\n", { flag: "wx" });
  return meta;
}

/**
 * Release the dream lock only when `token` matches the file.
 * Returns true if the lock file was removed.
 */
export async function releaseLock(token: string): Promise<boolean> {
  if (!token) return false;
  const meta = await readLockMeta();
  if (!meta) return false;
  if (!meta.token || meta.token !== token) {
    return false;
  }
  try {
    await unlink(lockPath());
    return true;
  } catch {
    return false;
  }
}

/** Indicates an attempt to acquire an already-held dream lock. */
export class LockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockError";
  }
}
