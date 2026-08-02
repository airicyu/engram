/** Future-sight API: expire-only maintain then list hot／later anchors. */

import {
  listAnchors,
  maintainFutureSight,
} from "../../store/memories/future-sight";
import { config } from "../../config";

/** Return future-sight anchors and ids swept on this request. */
export async function handleFutureSight(): Promise<object> {
  const result = await maintainFutureSight({
    mode: "expire_only",
    target: "live",
    commit: true,
  });
  const anchors = await listAnchors();
  return {
    anchors: anchors.map((a) => ({
      id: a.id,
      zone: a.zone,
      anchor_start: a.anchor_start,
      anchor_end: a.anchor_end,
      content: a.content,
    })),
    swept_expired: result.expired,
    future_sight_window_days: config.futureSightWindowDays,
    future_sight_hot_days: config.futureSightHotDays,
  };
}
