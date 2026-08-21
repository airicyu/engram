/** Activities API handler: append an L0 event and short-term memory pool entry. */

import {
  captureActivity,
  withCaptureLock,
  rollbackLastEventIfMatch,
} from "../store/memories/capture";
import {
  validateAttachments,
  buildAppendix,
  moveTmpToFormal,
  moveFormalToTmp,
  type AttachmentMeta,
} from "../store/memories/attachments";
import {
  appendEvent,
  nextEventIdFromLog,
  nowIso,
  type Event,
} from "../store/memories/activities";
import { appendPoolEntry, type PoolEntry } from "../store/memories/short-term-memory";
import { validateMentionsInRaw } from "../store/memories/mentions";
import { nodeExists } from "../store/memories/nodes";
import { logInfo } from "../log";

/** Request payload accepted by POST /activities. */
export interface ActivitiesBody {
  raw: string;
  source?: string;
  /** Removed in 0.32 — key presence → 400 `node_refs_removed`. */
  node_refs?: unknown;
  idempotency_key?: string;
  attachments?: AttachmentMeta[];
}

/** Validate mention tokens; reject create when live node already exists. */
async function validateActivityMentions(raw: string): Promise<Response | null> {
  const parsed = validateMentionsInRaw(raw);
  if (!parsed.ok) {
    return Response.json(
      {
        error: "invalid_mention_id",
        message: `Invalid mention id: ${JSON.stringify(parsed.bad_id)}`,
      },
      { status: 400 },
    );
  }
  for (const m of parsed.mentions) {
    if (m.mode !== "create") continue;
    if (await nodeExists(m.id)) {
      return Response.json(
        {
          error: "mention_create_exists",
          message: `Cannot create node "${m.id}": already exists; use node: ref instead`,
        },
        { status: 400 },
      );
    }
  }
  return null;
}

/** Validate and persist a captured memory event. */
export async function handleActivities(body: ActivitiesBody): Promise<{ event_id: string } | Response> {
  // 0.32: node_refs removed — key present (any value) → 400
  if (Object.prototype.hasOwnProperty.call(body, "node_refs")) {
    return Response.json(
      {
        error: "node_refs_removed",
        message:
          "`node_refs` was removed in 0.32; embed mentions in `raw` as [@id](node:id) or [@id](node-create:id)",
      },
      { status: 400 },
    );
  }

  if (!body.raw || typeof body.raw !== "string" || !body.raw.trim()) {
    return Response.json({ error: "raw is required" }, { status: 400 });
  }

  const mentionErr = await validateActivityMentions(body.raw);
  if (mentionErr) return mentionErr;

  // 0.29: attachments
  const attachments = body.attachments;

  if (attachments && attachments.length > 0) {
    // Entire attachment flow inside capture lock (INDEX #15)
    return withCaptureLock(async () => {
      // Validate attachments
      const validationError = await validateAttachments(body.raw, attachments);
      if (validationError) {
        return Response.json(validationError, { status: 400 });
      }

      // Build final raw with appendix
      const finalRaw = body.raw + buildAppendix(attachments);

      // Move files from tmp to formal
      const moved: { day: string; filename: string }[] = [];
      try {
        for (const a of attachments) {
          const parts = a.path.split("/");
          const day = parts[2]!;
          const filename = parts[3]!;
          await moveTmpToFormal(day, filename);
          moved.push({ day, filename });
        }
      } catch (e) {
        // Rollback already-moved files
        for (const m of moved) {
          await moveFormalToTmp(m.day, m.filename).catch(() => {});
        }
        return Response.json(
          {
            error: "move_failed",
            message: e instanceof Error ? e.message : "Failed to move attachment files",
          },
          { status: 500 },
        );
      }

      // Write L0 + STM inline (can't call captureActivity — it also uses withCaptureLock)
      try {
        const event_id = await nextEventIdFromLog();
        const ts = nowIso();
        const source = body.source ?? "api";

        const event: Event = {
          id: event_id,
          ts,
          source,
          raw: finalRaw,
          idempotency_key: body.idempotency_key,
          attachments,
        };

        await appendEvent(event);

        const poolEntry: PoolEntry = {
          id: event_id,
          ts,
          raw: finalRaw.trim(),
        };

        try {
          await appendPoolEntry(poolEntry);
        } catch (poolErr) {
          await rollbackLastEventIfMatch(event_id);
          throw poolErr;
        }

        return { event_id };
      } catch (e) {
        // Best-effort move back to tmp
        for (const m of moved) {
          await moveFormalToTmp(m.day, m.filename).catch(() => {});
        }
        logInfo("activities write failed after move", {
          error: e instanceof Error ? e.message : String(e),
          moved_count: moved.length,
        });
        return Response.json(
          {
            error: "write_failed",
            message: "Failed to write activity after moving attachments; files moved back to tmp",
          },
          { status: 500 },
        );
      }
    });
  }

  // No attachments: still validate (embeds/|alias checks; no tmp I/O when attachments is empty)
  const validationError = await validateAttachments(body.raw, attachments);
  if (validationError) {
    return Response.json(validationError, { status: 400 });
  }

  // No attachments: same as 0.28 flow
  const result = await captureActivity({
    raw: body.raw,
    source: body.source,
    idempotency_key: body.idempotency_key,
  });

  return { event_id: result.event_id };
}
