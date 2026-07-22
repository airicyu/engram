/** Future-sight API handler that sweeps expired anchors before listing active ones. */

import {
  listActiveAnchors,
  sweepExpiredFutureSight,
} from "../store/future-sight";

/** Return active future-sight anchors and anchors swept on this request. */
export async function handleFutureSight(): Promise<object> {
  const swept_expired = await sweepExpiredFutureSight();
  const active = await listActiveAnchors();
  return {
    anchors: active.map((a) => ({
      id: a.id,
      anchor_start: a.anchor_start,
      anchor_end: a.anchor_end,
      content: a.content,
      node_refs: a.node_refs ?? [],
    })),
    swept_expired,
  };
}
