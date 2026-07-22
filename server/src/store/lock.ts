/** File-based mutual exclusion for dream extraction and commit operations. */

import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { homePath } from "./home";

const STALE_LOCK_MS = 30 * 60 * 1000; // 30 minutes

/** Metadata persisted while a dream lock is held. */
export interface LockMeta {
  holder: string;
  acquired_at: string;
}

function lockPath(): string {
  return homePath("dream", "dream.lock");
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
    return JSON.parse(raw) as LockMeta;
  } catch {
    return null;
  }
}

/** Return whether the current lock has exceeded its allowed lifetime. */
export async function isLockStale(): Promise<boolean> {
  const meta = await readLockMeta();
  if (!meta) return false;
  const acquired = new Date(meta.acquired_at).getTime();
  return Date.now() - acquired > STALE_LOCK_MS;
}

/** Remove the lock only when it is stale. */
export async function breakStaleLock(): Promise<boolean> {
  if (await isLockStale()) {
    await unlink(lockPath());
    return true;
  }
  return false;
}

/** Acquire the exclusive dream lock for a named holder. */
export async function acquireLock(holder: string): Promise<void> {
  if (await isLocked()) {
    throw new LockError("dream.lock already held");
  }
  await writeFile(
    lockPath(),
    JSON.stringify({ holder, acquired_at: new Date().toISOString() }) + "\n",
    { flag: "wx" },
  );
}

/** Release the dream lock if present. */
export async function releaseLock(): Promise<void> {
  try {
    await unlink(lockPath());
  } catch {
    // already gone
  }
}

/** Indicates an attempt to acquire an already-held dream lock. */
export class LockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockError";
  }
}