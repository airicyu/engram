import { describe, expect, test } from "bun:test";
import { countP1WikilinkTargets, graphEdgeLevel } from "./node-graph";

describe("graphEdgeLevel", () => {
  test("refs 1–2 → 1; 3–4 → 2; clamp 10", () => {
    expect(graphEdgeLevel(1)).toBe(1);
    expect(graphEdgeLevel(2)).toBe(1);
    expect(graphEdgeLevel(3)).toBe(2);
    expect(graphEdgeLevel(4)).toBe(2);
    expect(graphEdgeLevel(5)).toBe(3);
    expect(graphEdgeLevel(8)).toBe(3);
    expect(graphEdgeLevel(1024)).toBe(10);
    expect(graphEdgeLevel(2048)).toBe(10);
  });
});

describe("countP1WikilinkTargets", () => {
  test("counts P1, ignores asymmetric and alias-only", () => {
    const md = [
      "[[nodes/acme/acme|Acme]]",
      "[[nodes/acme/acme]]",
      "[[nodes/self/self|x]]",
      "[[nodes/nope|bad]]",
      "[[nodes/a/b|mismatch]]",
    ].join("\n");
    const c = countP1WikilinkTargets(md);
    expect(c.get("acme")).toBe(2);
    expect(c.get("self")).toBe(1);
    expect(c.has("nope")).toBe(false);
    expect(c.has("a")).toBe(false);
  });
});
