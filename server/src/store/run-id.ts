/** Compact run identifiers for dream / ask jobs. */

import { nowIso } from "./events";

/** `YYYYMMDD-HHmmss` from an ISO local timestamp (`nowIso()` shape). */
export function compactStampFromIso(at: string): string {
  const m = at.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}${m[6]}`;
  return at.replace(/\D/g, "").slice(0, 15);
}

/** `{prefix}-YYYYMMDD-HHmmss-{rand6}` — URL-safe, ENGRAM_TZ local time + random suffix. */
export function makeRunId(prefix: string, at = nowIso()): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${compactStampFromIso(at)}-${rand}`;
}
