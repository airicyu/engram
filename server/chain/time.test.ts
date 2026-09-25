import { expect, test } from "bun:test";
import {
  canonicalWeekIdFromLegacy,
  dayToWeekId,
  isValidWeekId,
  weekDateRange,
  weekMonthKey,
} from "./time.ts";

test("week id validation (Engram-aligned)", () => {
  expect(isValidWeekId("2026-W30-0720")).toBe(true);
  expect(isValidWeekId("2026-W30")).toBe(false);
  expect(isValidWeekId("2026-W30-0721")).toBe(false);
  expect(dayToWeekId("2026-07-21")).toBe("2026-W30-0720");
});

test("week month folder uses Monday calendar month", () => {
  expect(weekMonthKey("2026-W01-1229")).toBe("2025-12");
  expect(weekDateRange("2026-W30-0720")).toEqual({ start: "2026-07-20", end: "2026-07-26" });
});

test("legacy week id upgrade", () => {
  expect(canonicalWeekIdFromLegacy("2026-W30")).toBe("2026-W30-0720");
});
