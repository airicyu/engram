/**
 * Activity mention parse／validate unit tests (0.32).
 * Run: `cd server && bun test src/store/memories/mentions.test.ts`
 */

import { describe, expect, test } from "bun:test";
import {
  formatMentionToken,
  parseMentions,
  sanitizeMentionId,
  validateMentionsInRaw,
  mentionCreateIds,
  mentionNodeIds,
} from "./mentions";

describe("mentions", () => {
  test("sanitizeMentionId accepts alnum and unicode letters", () => {
    expect(sanitizeMentionId("ken")).toBe("ken");
    expect(sanitizeMentionId("Acme_1")).toBe("Acme_1");
    expect(sanitizeMentionId("小明")).toBe("小明");
    expect(sanitizeMentionId("a.b-c")).toBe("a.b-c");
  });

  test("sanitizeMentionId rejects bad ids", () => {
    expect(sanitizeMentionId("")).toBeNull();
    expect(sanitizeMentionId(".")).toBeNull();
    expect(sanitizeMentionId("..")).toBeNull();
    expect(sanitizeMentionId("a/b")).toBeNull();
    expect(sanitizeMentionId("a b")).toBeNull();
    expect(sanitizeMentionId("a\\b")).toBeNull();
  });

  test("parseMentions extracts ref and create", () => {
    const raw = "hi [@ken](node:ken) and [@tommy](node-create:tommy)";
    const m = parseMentions(raw);
    expect(m.map((x) => ({ id: x.id, mode: x.mode }))).toEqual([
      { id: "ken", mode: "ref" },
      { id: "tommy", mode: "create" },
    ]);
    expect(mentionNodeIds(raw)).toEqual(["ken", "tommy"]);
    expect(mentionCreateIds(raw)).toEqual(["tommy"]);
  });

  test("non-mention shapes ignored", () => {
    expect(parseMentions("[ken](http://x) [[ken]] @ken")).toEqual([]);
  });

  test("validateMentionsInRaw rejects bad id in token", () => {
    const r = validateMentionsInRaw("[@x](node:bad/id)");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_mention_id");
  });

  test("formatMentionToken", () => {
    expect(formatMentionToken("ken", "ref")).toBe("[@ken](node:ken)");
    expect(formatMentionToken("tommy", "create")).toBe("[@tommy](node-create:tommy)");
  });
});
