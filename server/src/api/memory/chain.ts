/** GET /memory/chain — day + higher-level chain browse handlers. */

import {
  getChainDay,
  getChainMonth,
  getChainWeek,
  getChainYear,
  isValidDayId,
  isValidMonthIdBrowse,
  isValidWeekIdBrowse,
  isValidYearIdBrowse,
  listChainIndex,
  listMonthIndex,
  listWeekIndex,
  listYearIndex,
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

export async function handleWeekIndex() {
  return listWeekIndex();
}

export async function handleWeekDetail(weekId: string) {
  if (!isValidWeekIdBrowse(weekId)) {
    return { error: "invalid_week_id" as const };
  }
  return getChainWeek(weekId);
}

export async function handleMonthIndex() {
  return listMonthIndex();
}

export async function handleMonthDetail(monthId: string) {
  if (!isValidMonthIdBrowse(monthId)) {
    return { error: "invalid_month_id" as const };
  }
  return getChainMonth(monthId);
}

export async function handleYearIndex() {
  return listYearIndex();
}

export async function handleYearDetail(yearId: string) {
  if (!isValidYearIdBrowse(yearId)) {
    return { error: "invalid_year_id" as const };
  }
  return getChainYear(yearId);
}
