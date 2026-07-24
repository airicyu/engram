/** Virtual clock control API (time replay). */

import {
  clearVirtualNow,
  dateFromDayTime,
  getClockSnapshot,
  isVirtualClockAllowed,
  setVirtualNow,
} from "../store/clock";

/** Request body for PUT /clock. */
export interface ClockPutBody {
  now?: string;
  day?: string;
  time?: string;
}

function disabledResponse(): Response {
  return Response.json(
    {
      error: "virtual_clock_disabled",
      message: "Set ENGRAM_ALLOW_VIRTUAL_CLOCK=1 to enable PUT /clock",
    },
    { status: 403 },
  );
}

/** GET /clock — current memory timeline clock. */
export function handleClockGet(): object {
  return getClockSnapshot();
}

/** PUT /clock — set virtual now (requires ENGRAM_ALLOW_VIRTUAL_CLOCK=1). */
export async function handleClockPut(
  body: ClockPutBody,
): Promise<object | Response> {
  if (!isVirtualClockAllowed()) {
    return disabledResponse();
  }

  let iso: string;
  try {
    if (typeof body.now === "string" && body.now.trim()) {
      iso = await setVirtualNow(body.now.trim());
    } else if (typeof body.day === "string" && body.day.trim()) {
      const time =
        typeof body.time === "string" && body.time.trim()
          ? body.time.trim()
          : "12:00:00";
      const d = dateFromDayTime(body.day.trim(), time);
      iso = await setVirtualNow(d);
    } else {
      return Response.json(
        {
          error: "invalid_body",
          message: "Provide `now` (ISO-8601) or `day` (YYYY-MM-DD) with optional `time` (HH:mm:ss)",
        },
        { status: 400 },
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "invalid_datetime", message: msg }, { status: 400 });
  }

  return { ...getClockSnapshot(), set: iso };
}

/** DELETE /clock — clear virtual clock (back to system). Always allowed. */
export async function handleClockDelete(): Promise<object> {
  await clearVirtualNow();
  return getClockSnapshot();
}
