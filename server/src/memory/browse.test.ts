import { describe, expect, test } from "bun:test";
import { nodeWikilinksToDisplayText, previewText } from "./browse";

describe("nodeWikilinksToDisplayText", () => {
  test("P1 uses alias, else id", () => {
    expect(nodeWikilinksToDisplayText("see [[nodes/eric/eric|Eric]]")).toBe("see Eric");
    expect(nodeWikilinksToDisplayText("see [[nodes/eric/eric]]")).toBe("see eric");
  });

  test("short form uses alias, else dest", () => {
    expect(nodeWikilinksToDisplayText("[[mak|Mak]] and [[eric]]")).toBe("Mak and eric");
  });

  test("leaves embeds, heading refs, asymmetric paths", () => {
    const embed = "pic ![[_attachments/uploads/2026-08-09/menu.png]]";
    expect(nodeWikilinksToDisplayText(embed)).toBe(embed);
    expect(nodeWikilinksToDisplayText("[[nodes/eric/eric#Identity]]")).toBe(
      "[[nodes/eric/eric#Identity]]",
    );
    expect(nodeWikilinksToDisplayText("[[nodes/a/b|x]]")).toBe("[[nodes/a/b|x]]");
  });
});

describe("previewText", () => {
  test("substitutes display text before truncating", () => {
    const md = "Talked with [[nodes/eric/eric|eric]] about [[nodes/engram/engram|engram]].";
    expect(previewText(md)).toBe("Talked with eric about engram.");
    expect(previewText(md).includes("[[")).toBe(false);
  });

  test("truncates after substitution so aliases are not sliced mid-wikilink", () => {
    const md = `[[nodes/engram/engram|engram]] ${"x".repeat(90)}`;
    const out = previewText(md);
    expect(out.startsWith("engram ")).toBe(true);
    expect(out.includes("[[")).toBe(false);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBe(81);
  });
});
