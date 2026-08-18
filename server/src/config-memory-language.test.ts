import { describe, expect, test } from "bun:test";
import { memoryLanguagePromptLabel } from "./config";

describe("memoryLanguagePromptLabel", () => {
  test("zh-Hant spells 繁體中文書面語", () => {
    const label = memoryLanguagePromptLabel("zh-Hant");
    expect(label.startsWith("zh-Hant")).toBe(true);
    expect(label.includes("繁體中文書面語")).toBe(true);
    expect(label.includes("written style")).toBe(true);
  });

  test("other codes stay labeled", () => {
    expect(memoryLanguagePromptLabel("zh-Hans")).toContain("简体中文书面语");
    expect(memoryLanguagePromptLabel("en")).toBe("en — English");
  });
});
