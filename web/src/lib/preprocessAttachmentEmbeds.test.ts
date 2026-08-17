import { describe, expect, test } from "bun:test";
import { preprocessAttachmentEmbeds } from "./preprocessAttachmentEmbeds";
import { preprocessNodeWikilinks } from "./preprocessNodeWikilinks";

describe("preprocessAttachmentEmbeds", () => {
  test("exact embed becomes markdown image", () => {
    const path = "_attachments/uploads/2026-08-15/seaside-eric-mak.jpg";
    expect(preprocessAttachmentEmbeds(`pic ![[${path}]] end`)).toBe(
      `pic ![seaside-eric-mak.jpg](/api/attachments/file?path=${encodeURIComponent(path)}) end`,
    );
  });

  test("alias form unchanged", () => {
    const md = "![[_attachments/uploads/2026-08-15/x.jpg|nice]]";
    expect(preprocessAttachmentEmbeds(md)).toBe(md);
  });

  test("tmp path unchanged", () => {
    const md = "![[_attachments/uploads/tmp/2026-08-15/x.jpg]]";
    expect(preprocessAttachmentEmbeds(md)).toBe(md);
  });

  test("non-attachment wikilink unchanged", () => {
    const md = "![[notes/foo]]";
    expect(preprocessAttachmentEmbeds(md)).toBe(md);
  });

  test("survives node wikilink preprocess then converts", () => {
    const md = "see [[nodes/eric/eric]] and ![[_attachments/uploads/2026-08-15/x.png]]";
    const afterNodes = preprocessNodeWikilinks(md);
    expect(afterNodes).toContain("[eric](#/memory/nodes/eric)");
    expect(afterNodes).toContain("![[_attachments/uploads/2026-08-15/x.png]]");
    const afterBoth = preprocessAttachmentEmbeds(afterNodes);
    expect(afterBoth).toContain("[eric](#/memory/nodes/eric)");
    expect(afterBoth).toContain(
      `![x.png](/api/attachments/file?path=${encodeURIComponent("_attachments/uploads/2026-08-15/x.png")})`,
    );
  });
});
