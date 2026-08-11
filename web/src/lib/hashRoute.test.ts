import { describe, expect, test } from "bun:test";
import {
  encodeHashId,
  parseHash,
  serializeHash,
} from "./hashRoute";

describe("parseHash", () => {
  test("empty → activities", () => {
    expect(parseHash("")).toEqual({ scene: "activities" });
    expect(parseHash("#")).toEqual({ scene: "activities" });
    expect(parseHash("#/")).toEqual({ scene: "activities" });
  });

  test("five scenes", () => {
    expect(parseHash("#/consolidate")).toEqual({ scene: "consolidate" });
    expect(parseHash("#/clarify")).toEqual({ scene: "clarify" });
    expect(parseHash("#/seek")).toEqual({ scene: "seek" });
  });

  test("#/memory → chain mode", () => {
    expect(parseHash("#/memory")).toEqual({
      scene: "memory",
      memory: { mode: "chain" },
    });
  });

  test("memory chain + nodes deep links", () => {
    expect(parseHash("#/memory/chain/day/2026-07-23")).toEqual({
      scene: "memory",
      memory: { mode: "chain", level: "day", id: "2026-07-23" },
    });
    expect(parseHash("#/memory/nodes/eric")).toEqual({
      scene: "memory",
      memory: { mode: "nodes", id: "eric" },
    });
  });

  test("unknown level → chain mode fallback", () => {
    expect(parseHash("#/memory/chain/fortnight/x")).toEqual({
      scene: "memory",
      memory: { mode: "chain" },
    });
  });

  test("URL-encoded id", () => {
    expect(parseHash("#/memory/nodes/%E4%B8%AD%E6%96%87")).toEqual({
      scene: "memory",
      memory: { mode: "nodes", id: "中文" },
    });
  });
});

describe("serializeHash", () => {
  test("round-trip scenes", () => {
    expect(serializeHash({ scene: "activities" })).toBe("#/activities");
    expect(
      serializeHash({
        scene: "memory",
        memory: { mode: "nodes", id: "eric" },
      }),
    ).toBe("#/memory/nodes/eric");
    expect(
      serializeHash({
        scene: "memory",
        memory: { mode: "chain", level: "week", id: "2026-W20-0511" },
      }),
    ).toBe("#/memory/chain/week/2026-W20-0511");
  });

  test("encode non-safe id", () => {
    expect(encodeHashId("中文")).toBe(encodeURIComponent("中文"));
    expect(
      serializeHash({
        scene: "memory",
        memory: { mode: "nodes", id: "中文" },
      }),
    ).toBe(`#/memory/nodes/${encodeURIComponent("中文")}`);
  });
});
