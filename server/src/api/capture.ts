/** Capture API handler for appending an L0 event and L1 pool entry. */

import { appendEvent, nextEventId, nowIso } from "../store/events";
import { appendPoolEntry } from "../store/l1";
import { isLocked } from "../store/lock";

/** Request payload accepted by POST /capture. */
export interface CaptureBody {
  raw: string;
  source?: string;
  node_refs?: string[];
  idempotency_key?: string;
}

/** Validate and persist a captured memory event. */
export async function handleCapture(body: CaptureBody): Promise<{ event_id: string } | Response> {
  if (await isLocked()) {
    return Response.json(
      { error: "dream_locked", message: "Dream in progress; capture rejected" },
      { status: 409 },
    );
  }

  if (!body.raw || typeof body.raw !== "string" || !body.raw.trim()) {
    return Response.json({ error: "raw is required" }, { status: 400 });
  }

  const event_id = await nextEventId();
  const ts = nowIso();
  const source = body.source ?? "api";
  const node_refs = body.node_refs;

  await appendEvent({
    id: event_id,
    ts,
    source,
    raw: body.raw,
    node_refs,
    idempotency_key: body.idempotency_key,
  });

  await appendPoolEntry({
    id: event_id,
    ts,
    raw: body.raw.trim(),
    node_refs,
  });

  return { event_id };
}
