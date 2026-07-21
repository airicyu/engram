import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { homePath } from "./home";

const STALE_LOCK_MS = 30 * 60 * 1000; // 30 minutes

export interface LockMeta {
  holder: string;
  acquired_at: string;
}

function lockPath(): string {
  return homePath("dream", "dream.lock");
}

export async function isLocked(): Promise<boolean> {
  try {
    await access(lockPath());
    return true;
  } catch {
    return false;
  }
}

export async function readLockMeta(): Promise<LockMeta | null> {
  try {
    const raw = await readFile(lockPath(), "utf8");
    return JSON.parse(raw) as LockMeta;
  } catch {
    return null;
  }
}

export async function isLockStale(): Promise<boolean> {
  const meta = await readLockMeta();
  if (!meta) return false;
  const acquired = new Date(meta.acquired_at).getTime();
  return Date.now() - acquired > STALE_LOCK_MS;
}

export async function breakStaleLock(): Promise<boolean> {
  if (await isLockStale()) {
    await unlink(lockPath());
    return true;
  }
  return false;
}

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

export async function releaseLock(): Promise<void> {
  try {
    await unlink(lockPath());
  } catch {
    // already gone
  }
}

export class LockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockError";
  }
}