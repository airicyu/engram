import { expect, test } from "bun:test";
import { CLARIFY_GENERATE_MAX, clarifyQuotaResult, promptClarifyGenerate } from "./pi.ts";

test("zero new questions need a skip sentence and one to five do not", () => {
  expect(clarifyQuotaResult(0, "  No askable gap.  ")).toEqual({
    skipReason: "No askable gap.",
  });
  expect(clarifyQuotaResult(1, "asked one")).toEqual({});
  expect(clarifyQuotaResult(CLARIFY_GENERATE_MAX, "")).toEqual({});
  expect(() => clarifyQuotaResult(0, " \n ")).toThrow(/skip reason/);
  expect(() => clarifyQuotaResult(CLARIFY_GENERATE_MAX + 1, "too many")).toThrow(/max is 5/);
});

test("generate prompt does not demand a minimum of three", () => {
  const prompt = promptClarifyGenerate();
  expect(prompt).toContain("at most 5");
  expect(prompt).toContain("Zero is allowed");
  expect(prompt).not.toMatch(/MIN|at least 3|retry/i);
});
