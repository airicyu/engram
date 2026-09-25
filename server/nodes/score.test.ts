import { expect, test } from "bun:test";
import {
  mergeActivityScoreIntoMarkdown,
  parseActivityScoreFromMarkdown,
  parseActivityScoreFromYaml,
} from "./score.ts";

test("parseActivityScoreFromMarkdown", () => {
  expect(parseActivityScoreFromMarkdown("# Hi")).toBe(null);
  expect(
    parseActivityScoreFromMarkdown("---\nactivity_score: 72\n---\n# Node\n"),
  ).toBe(72);
  expect(
    parseActivityScoreFromMarkdown("---\nactivity_score: 150\n---\n# Node\n"),
  ).toBe(100);
});

test("mergeActivityScoreIntoMarkdown", () => {
  const md = "# Title\n\nBody.";
  const out = mergeActivityScoreIntoMarkdown(md, 55);
  expect(out).toContain("activity_score: 55");
  expect(parseActivityScoreFromMarkdown(out)).toBe(55);
});

test("parseActivityScoreFromYaml", () => {
  expect(parseActivityScoreFromYaml("score: 40\n")).toBe(40);
  expect(parseActivityScoreFromYaml("activity_score: 41\n")).toBe(41);
});
