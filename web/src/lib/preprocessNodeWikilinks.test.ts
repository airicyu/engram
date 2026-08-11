import { describe, expect, test } from "bun:test";
import { preprocessNodeWikilinks } from "./preprocessNodeWikilinks";

describe("preprocessNodeWikilinks", () => {
  test("P1 with and without label", () => {
    expect(preprocessNodeWikilinks("see [[nodes/eric/eric|Eric]]")).toBe(
      "see [Eric](#/memory/nodes/eric)",
    );
    expect(preprocessNodeWikilinks("see [[nodes/eric/eric]]")).toBe(
      "see [eric](#/memory/nodes/eric)",
    );
  });

  test("short form only when known", () => {
    const known = new Set(["eric"]);
    expect(preprocessNodeWikilinks("[[eric]] and [[ghost]]", known)).toBe(
      "[eric](#/memory/nodes/eric) and [[ghost]]",
    );
    expect(preprocessNodeWikilinks("[[eric|E]]", known)).toBe(
      "[E](#/memory/nodes/eric)",
    );
    expect(preprocessNodeWikilinks("[[eric]]")).toBe("[[eric]]");
  });

  test("does not break attachment embeds", () => {
    const md = "pic ![[_attachments/uploads/2026-08-09/menu.png]] end";
    expect(preprocessNodeWikilinks(md, new Set(["menu"]))).toBe(md);
  });

  test("asymmetric path unchanged", () => {
    expect(preprocessNodeWikilinks("[[nodes/a/b]]")).toBe("[[nodes/a/b]]");
  });

  test("heading／block refs unchanged", () => {
    expect(preprocessNodeWikilinks("[[nodes/eric/eric#Identity]]")).toBe(
      "[[nodes/eric/eric#Identity]]",
    );
  });
});
