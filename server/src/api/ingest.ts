import { appendEvent, nextEventId, taipeiNowIso } from "../store/events";
import { appendSummary, appendNodeNotes } from "../store/l1";
import { isLocked } from "../store/lock";

export interface IngestBody {
  raw: string;
  source?: string;
  node_refs?: string[];
  idempotency_key?: string;
}

export async function handleIngest(body: IngestBody): Promise<{ event_id: string } | Response> {
  if (await isLocked()) {
    return Response.json(
      { error: "dream_locked", message: "Dream in progress; ingest rejected" },
      { status: 409 },
    );
  }

  if (!body.raw || typeof body.raw !== "string" || !body.raw.trim()) {
    return Response.json({ error: "raw is required" }, { status: 400 });
  }

  const event_id = await nextEventId();
  const ts = taipeiNowIso();
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

  const summaryLine = `- [${ts}] (${event_id}) ${body.raw.trim()}`;
  await appendSummary(summaryLine);

  if (node_refs?.length) {
    for (const nodeId of node_refs) {
      await appendNodeNotes(nodeId, summaryLine);
    }
  }

  return { event_id };
}
