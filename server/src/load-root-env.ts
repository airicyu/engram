/**
 * Load Engram repo-root `.env` into `process.env` (do not override already-set keys).
 * Nested `server/.env` is no longer used (0.39).
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

let loaded = false;

/** This file lives in `server/src/` → repo root is `../..`. */
export function loadEngramRootEnv(): string {
  const repoRoot = resolve(import.meta.dir, "../..");
  if (loaded) return repoRoot;
  loaded = true;

  const envPath = join(repoRoot, ".env");
  if (existsSync(envPath)) {
    const parsed = parseDotEnv(readFileSync(envPath, "utf8"));
    for (const [key, val] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }

  const leftover = join(repoRoot, "server", ".env");
  if (existsSync(leftover)) {
    console.warn(`engram: ignoring ${leftover}; use ${envPath} only.`);
  }

  return repoRoot;
}
