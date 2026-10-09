import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const src = readFileSync(join(import.meta.dir, "../../web/ingest-payload.js"), "utf8");
eval(src);

const buildIngestPayload = globalThis.buildIngestPayload as (
  raw: string,
  pendingAttach: { path: string; relationship: string }[],
  defaultRel: string,
) => { raw: string; attachments?: { path: string; relationship: string }[] };

const shot = "_attachments/uploads/2026-10-03/WhatsApp Image 2026-10-02 at 17.54.41.jpeg";

describe("buildIngestPayload", () => {
  test("preview image missing from the compose text is still posted", () => {
    const body = buildIngestPayload("2/10 有同事 last day，影相留念。", [{ path: shot, relationship: "本則附圖" }], "本則附圖");
    expect(body.raw).toContain(`![[${shot}]]`);
    expect(body.attachments).toEqual([{ path: shot, relationship: "本則附圖" }]);
  });

  test("image-only preview still produces a symmetric body", () => {
    const body = buildIngestPayload("", [{ path: shot, relationship: "合照" }], "本則附圖");
    expect(body.raw).toBe(`![[${shot}]]`);
    expect(body.attachments).toEqual([{ path: shot, relationship: "合照" }]);
  });

  test("embed already in the text is not duplicated", () => {
    const raw = `note\n\n![[${shot}]]`;
    const body = buildIngestPayload(raw, [{ path: shot, relationship: "合照" }], "本則附圖");
    expect(body.raw.match(/!\[\[/g)?.length).toBe(1);
    expect(body.attachments).toEqual([{ path: shot, relationship: "合照" }]);
  });

  test("blank relationship falls back to the default", () => {
    const body = buildIngestPayload("note", [{ path: shot, relationship: "  " }], "本則附圖");
    expect(body.attachments?.[0]?.relationship).toBe("本則附圖");
  });

  test("text without a preview stays a raw-only body", () => {
    expect(buildIngestPayload("hello", [], "本則附圖")).toEqual({ raw: "hello" });
  });
});
