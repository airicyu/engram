/** Activities API handler: append an L0 event and short-term memory pool entry. */

import { captureActivity } from "../store/memories/capture";
import { isLocked } from "../store/dreams/lock";

/** Request payload accepted by POST /activities. */
export interface ActivitiesBody {
  raw: string;
  source?: string;
  node_refs?: string[];
  idempotency_key?: string;
}

/** Validate and persist a captured memory event. */
export async function handleActivities(body: ActivitiesBody): Promise<{ event_id: string } | Response> {
  if (await isLocked()) {
    return Response.json(
      { error: "dream_locked", message: "Dream in progress; capture rejected" },
      { status: 409 },
    );
  }

  if (!body.raw || typeof body.raw !== "string" || !body.raw.trim()) {
    return Response.json({ error: "raw is required" }, { status: 400 });
  }

  // 0.20: node_refs must be string[] when present (string would be for…of'd as chars).
  if (body.node_refs !== undefined) {
    if (
      !Array.isArray(body.node_refs) ||
      body.node_refs.some((x) => typeof x !== "string")
    ) {
      return Response.json(
        {
          error: "invalid_node_refs",
          message: "`node_refs` must be an array of strings when provided",
        },
        { status: 400 },
      );
    }
  }

  const result = await captureActivity({
    raw: body.raw,
    source: body.source,
    node_refs: body.node_refs,
    idempotency_key: body.idempotency_key,
  });

  return { event_id: result.event_id };
}
