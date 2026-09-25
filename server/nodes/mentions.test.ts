import { describe, expect, test } from "bun:test";
import {
  formatCreateMentionToken,
  mentionCreateIds,
  parseCreateMentions,
  sanitizeMentionId,
  validateCreateMentionsInRaw,
} from "../nodes/mentions.ts";

describe("sanitizeMentionId", () => {
  test("accepts Unicode letters and kebab", () => {
    expect(sanitizeMentionId("君揚")).toBe("君揚");
    expect(sanitizeMentionId("mak媽媽")).toBe("mak媽媽");
    expect(sanitizeMentionId("beacon-1")).toBe("beacon-1");
  });

  test("rejects spaces and path junk", () => {
    expect(sanitizeMentionId("a b")).toBeNull();
    expect(sanitizeMentionId("a/b")).toBeNull();
    expect(sanitizeMentionId("..")).toBeNull();
    expect(sanitizeMentionId("")).toBeNull();
  });
});

describe("parseCreateMentions", () => {
  test("extracts create tokens; ignores wikilinks", () => {
    const raw =
      "見 [[nodes/mak/mak|mak]] 與 [@君揚](node-create:君揚) 同桌";
    expect(parseCreateMentions(raw)).toEqual([
      { id: "君揚", label: "君揚", start: expect.any(Number), end: expect.any(Number) },
    ]);
    expect(mentionCreateIds(raw)).toEqual(["君揚"]);
  });

  test("formatCreateMentionToken", () => {
    expect(formatCreateMentionToken("tommy")).toBe("[@tommy](node-create:tommy)");
    expect(formatCreateMentionToken("tommy", "Tommy")).toBe("[@Tommy](node-create:tommy)");
  });
});

describe("validateCreateMentionsInRaw", () => {
  test("ok when create id not live", () => {
    const r = validateCreateMentionsInRaw("hi [@新友](node-create:新友)", ["mak"]);
    expect(r).toEqual({ ok: true, createIds: ["新友"] });
  });

  test("mention_create_exists when live", () => {
    const r = validateCreateMentionsInRaw("[@mak](node-create:mak)", ["mak"]);
    expect(r).toEqual({ ok: false, error: "mention_create_exists", id: "mak" });
  });

  test("invalid_mention_id", () => {
    const r = validateCreateMentionsInRaw("[@x](node-create:a/b)", []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_mention_id");
  });
});
