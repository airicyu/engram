import { describe, expect, test } from "bun:test";
import { chainPreviewFromMarkdown, wikilinksToPlainText } from "../vault/index.ts";

describe("chain index preview", () => {
  test("chainPreviewFromMarkdown strips embeds and headings", () => {
    const md = `---
id: x
---
## 虛構日

![[_attachments/uploads/2026-08-23/demo.png]]

見 [[nodes/demo|示範節點]] 與正文。`;
    const p = chainPreviewFromMarkdown(md);
    expect(p).toContain("示範節點");
    expect(p).not.toContain("![[");
    expect(p.length).toBeLessThanOrEqual(81);
  });

  test("wikilinksToPlainText", () => {
    expect(wikilinksToPlainText("[[a/b|標籤]]")).toBe("標籤");
  });

});
