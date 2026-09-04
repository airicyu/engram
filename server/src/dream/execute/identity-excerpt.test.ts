/**
 * Identity excerpt for day-extract frozen JSON.
 * Run: cd server && bun test src/dream/execute/identity-excerpt.test.ts
 */

import { describe, expect, test } from "bun:test";
import { extractIdentityExcerpt } from "./identity-excerpt";

describe("extractIdentityExcerpt", () => {
  test("takes first ## Identity section", () => {
    const md = [
      "## Identity",
      "",
      "Acme is a vendor.",
      "",
      "## Relation",
      "",
      "_None_",
      "",
    ].join("\n");
    expect(extractIdentityExcerpt(md)).toBe("Acme is a vendor.");
  });

  test("empty Identity body → _None_", () => {
    const md = "## Identity\n\n\n## Relation\n\n_None_\n";
    expect(extractIdentityExcerpt(md)).toBe("_None_");
  });

  test("no Identity heading → empty", () => {
    expect(extractIdentityExcerpt("## Relation\n\n_None_\n")).toBe("");
  });

  test("### Identity is not a match", () => {
    const md = "### Identity\n\nLooks like identity\n\n## Relation\n\n_None_\n";
    expect(extractIdentityExcerpt(md)).toBe("");
  });

  test("## identity lowercase is not a match", () => {
    const md = "## identity\n\nLooks like identity\n";
    expect(extractIdentityExcerpt(md)).toBe("");
  });

  test("CRLF normalized", () => {
    const md = "## Identity\r\n\r\nVendor.\r\n\r\n## Relation\r\n\r\n_None_\r\n";
    expect(extractIdentityExcerpt(md)).toBe("Vendor.");
  });

  test("caps at 8 lines then ellipsis", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    const md = `## Identity\n\n${lines.join("\n")}\n\n## Relation\n`;
    const out = extractIdentityExcerpt(md);
    expect(out.endsWith("…")).toBe(true);
    expect(out.split("\n").length).toBe(8);
    expect(out).toContain("line 8");
    expect(out).not.toContain("line 9");
  });
});
