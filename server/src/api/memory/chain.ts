/** GET /memory/chain — day index; GET /memory/chain/{day_id} — day detail. */

import {
  getChainDay,
  isValidDayId,
  listChainIndex,
} from "../../memory/browse";

export async function handleChainIndex() {
  return listChainIndex();
}

export async function handleChainDay(dayId: string) {
  if (!isValidDayId(dayId)) {
    return { error: "invalid_day_id" as const };
  }
  return getChainDay(dayId);
}
