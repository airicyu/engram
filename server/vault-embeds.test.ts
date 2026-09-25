import { describe, expect, test } from "bun:test";
import {
  isValidAttachmentEmbedPath,
  listWikilinkEmbedPaths,
  normalizeAttachmentEmbedsInMarkdown,
} from "./vault-embeds.ts";

describe("vault-embeds", () => {
  const path = "_attachments/uploads/2026-08-23/demo-scene.png";
  const enc = encodeURIComponent(path);

  test("normalize HTTP markdown image to wikilink", () => {
    const md = `intro\n![pic](/api/attachments/file?path=${enc})\noutro`;
    expect(normalizeAttachmentEmbedsInMarkdown(md)).toBe(`intro\n![[${path}]]\noutro`);
  });

  test("normalize without /api prefix", () => {
    const md = `![x](/attachments/file?path=${enc})`;
    expect(normalizeAttachmentEmbedsInMarkdown(md)).toBe(`![[${path}]]`);
  });

  test("leaves existing wikilink", () => {
    const md = `![[${path}]]`;
    expect(normalizeAttachmentEmbedsInMarkdown(md)).toBe(md);
  });

  test("listWikilinkEmbedPaths", () => {
    const md = `a ![[${path}]] b`;
    expect(listWikilinkEmbedPaths(md)).toEqual([path]);
  });

  test("isValidAttachmentEmbedPath rejects traversal", () => {
    expect(isValidAttachmentEmbedPath("_attachments/uploads/2026-08-23/../x.png")).toBe(false);
  });
});
