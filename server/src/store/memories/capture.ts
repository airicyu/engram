/**
 * Single capture write path (0.20): allocate id + L0 append + short-term pool
 * under one process mutex so concurrent POSTs cannot collide on event ids
 * or leave "L0-only / pool-only" half state on success responses.
 */

import {
  appendEvent,
  nextEventIdFromLog,
  nowIso,
  rewriteEvents,
  readAllEvents,
  type Event,
} from "./activities";
import { appendPoolEntry, type PoolEntry } from "./short-term-memory";

/** Serialize all capture mutations in this process. */
let captureChain: Promise<unknown> = Promise.resolve();

function withCaptureLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = captureChain.then(fn, fn);
  // Keep the chain alive even if `fn` rejects.
  captureChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export type CaptureInput = {
  raw: string;
  source?: string;
  node_refs?: string[];
  idempotency_key?: string;
  ingest_meta?: Record<string, unknown>;
  /** Override timestamp (tests／system); default nowIso(). */
  ts?: string;
};

export type CaptureResult = {
  event_id: string;
  ts: string;
};

/**
 * If pool／derived write fails after L0 append, remove the trailing L0 line
 * when it matches `event_id` (best-effort compensation; prototype single-server).
 */
async function rollbackLastEventIfMatch(eventId: string): Promise<void> {
  try {
    const events = await readAllEvents();
    const last = events[events.length - 1];
    if (!last || last.id !== eventId) return;
    await rewriteEvents(events.slice(0, -1));
  } catch {
    // leave L0 as-is; caller already surfaces the pool error
  }
}

/**
 * Capture one activity: unique id + L0 + short-term pool, under the capture lock.
 * On pool failure: attempt L0 rollback of the just-appended line, then rethrow.
 */
export async function captureActivity(input: CaptureInput): Promise<CaptureResult> {
  return withCaptureLock(async () => {
    const event_id = await nextEventIdFromLog();
    const ts = input.ts ?? nowIso();
    const source = input.source ?? "api";
    const raw = input.raw;
    const node_refs = input.node_refs;

    const event: Event = {
      id: event_id,
      ts,
      source,
      raw,
      node_refs,
      idempotency_key: input.idempotency_key,
      ingest_meta: input.ingest_meta,
    };

    await appendEvent(event);

    const poolEntry: PoolEntry = {
      id: event_id,
      ts,
      raw: raw.trim(),
      node_refs,
    };

    try {
      await appendPoolEntry(poolEntry);
    } catch (e) {
      await rollbackLastEventIfMatch(event_id);
      throw e;
    }

    return { event_id, ts };
  });
}

/** Expose lock for tests that need to assert serialization without HTTP. */
export async function withCaptureLockForTests<T>(fn: () => Promise<T>): Promise<T> {
  return withCaptureLock(fn);
}
