import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");
const html = readFileSync(join(root, "web/index.html"), "utf8");
const css = readFileSync(join(root, "web/style.css"), "utf8");
const js = readFileSync(join(root, "web/app.js"), "utf8");
const mentionJs = readFileSync(join(root, "web/mention-composer.js"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const i18nPath = join(root, "web/i18n.js");
const i18n = existsSync(i18nPath) ? readFileSync(i18nPath, "utf8") : "";

describe("Track E shell (static left rail)", () => {
  test("index.html has left sidebar with four scenes in INDEX order", () => {
    expect(html).toContain('class="shell"');
    expect(html).toContain('class="atmosphere"');
    expect(html).toContain("status-light");
    expect(html).toContain('class="sidebar"');
    expect(html).toContain('class="side-nav"');
    expect(html).toContain('href="#/events"');
    expect(html).toContain('href="#/seek"');
    expect(html).toContain('href="#/clarify"');
    expect(html).toContain('href="#/memory"');
    const events = html.indexOf('href="#/events"');
    const seek = html.indexOf('href="#/seek"');
    const clarify = html.indexOf('href="#/clarify"');
    const memory = html.indexOf('href="#/memory"');
    expect(events).toBeGreaterThan(-1);
    expect(seek).toBeGreaterThan(events);
    expect(clarify).toBeGreaterThan(seek);
    expect(memory).toBeGreaterThan(clarify);
    expect(html).toContain("事件");
    expect(html).toContain("尋問");
    expect(html).toContain("提問郵箱");
    expect(html).toContain("記憶");
  });

  test("CSS is Engram cold paper + green accent left rail", () => {
    expect(css).toContain("--paper: #eef1f4");
    expect(css).toContain("--paper-deep: #e2e7ec");
    expect(css).toContain("--accent: #1f6b63");
    expect(css).toContain("--ink: #1c2430");
    expect(css).toContain(".shell");
    expect(css).toContain(".atmosphere");
    expect(css).toContain(".status-light");
    expect(js).toContain("refreshStatusLight");
    expect(js).toContain("syncStageLocked");
    expect(js).toContain("formatNodeActivityMeta");
    expect(css).toContain(".sidebar");
    expect(css).toContain(".side-nav");
    expect(css).toContain(".side-nav a.active");
    expect(css).not.toMatch(/^header\s*\{/m);
    expect(css).not.toContain("#f6f4ef");
  });

  test("app.js syncs nav + memory subhashes", () => {
    expect(js).toContain("function syncNav");
    expect(js).toContain("data-nav");
    expect(js).toContain("#/memory/nodes");
    expect(js).toContain('startsWith("memory/graph")');
    expect(js).toContain("#/memory/future");
    expect(js).toContain("renderFuture");
    expect(js).toContain("renderSeek");
    expect(js).toContain("renderClarify");
    expect(js).toContain("renderGraph");
  });

  test("no Vite/React toolchain introduced", () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(deps)) {
      expect(name).not.toMatch(/^(vite|react|react-dom|@vitejs\/)/);
    }
    expect(html).not.toContain("react");
    expect(html).not.toMatch(/type=["']module["'].*vite/i);
  });
});

describe("UI refresh smoke (i18n / compose / tabs / locale)", () => {
  test("i18n.js loaded with engram-lite.locale key", () => {
    expect(existsSync(i18nPath)).toBe(true);
    expect(html).toContain("i18n.js");
    expect(i18n).toContain("engram-lite.locale");
    expect(i18n).toContain("zh-Hant");
    expect(i18n).toContain('"en"');
      });

  test("events page has compose-card, post button, two tabs", () => {
    expect(html).toContain("mention-composer.js");
    expect(mentionJs).toContain("bindMentionComposer");
    expect(js).toContain("bindMentionComposer");
    expect(js).toContain("compose-card");
    expect(js).toContain("compose-editor");
    expect(mentionJs).toContain("composeEditorToRaw");
    expect(mentionJs).toContain("mention-chip");
    expect(mentionJs).toContain("node-create");
    expect(mentionJs).toContain("mention-chip--create");
    expect(i18n).toContain("activities.mention_create");
    expect(js).toContain("events-tab");
    expect(js).toContain("events.tab_recent");
    expect(js).toContain("events.tab_consolidate");
    expect(i18n).toContain("先寫進待沉澱");
    expect(i18n).toContain("Capture goes to the pending pool");
    expect(i18n).toContain("發帖");
    expect(i18n).toContain("近期輸入內容");
    expect(i18n).toContain("沉澱入夢");
    expect(js).not.toContain("記入 pool");
    expect(js).not.toContain("dream_reports");
    expect(js).not.toContain("approve");
  });

  test("attachment remove strips embed from raw", () => {
    expect(js).toContain("removeAttach");
    expect(js).toContain("attachment-remove-btn");
    expect(js).toContain("attachment-relationship");
    expect(js).toContain("![[");
    expect(i18n).toContain("這張圖與記憶的關係…");
  });

  test("locale switcher + memory domain tabs + Engram scenes", () => {
    expect(html).toContain("locale-switch");
    expect(html).toContain('data-locale="zh-Hant"');
    expect(html).toContain('data-locale="en"');
    expect(html).toContain("繁體中文");
    expect(css).toContain("--accent: #1f6b63");
    expect(css).toContain(".mention-menu");
    expect(css).toContain(".mention-chip--create");
    expect(css).toContain(".mode-btn");
    expect(css).toContain(".inbox-layout");
    expect(css).toContain(".browse-layout");
    expect(css).toContain(".packet-block");
    expect(js).toContain("memory.lead");
    expect(js).toContain("memoryDomainModes");
    expect(js).toContain("bindMemoryDomainModes");
    expect(js).toContain("resolveAttachmentImageSrc");
    expect(js).toContain("browse-group-label");
    expect(js).toContain("memory.future");
    expect(js).toContain("data-seek-mode");
    expect(js).toContain("inbox-layout");
    expect(js).toContain("browse-layout");
    expect(js).toContain("seek.mode_ask");
    expect(i18n).toContain("記憶鏈");
    expect(i18n).toContain("瀏覽 vault");
    expect(i18n).toContain("口語提問");
    expect(i18n).toContain("seek.mode_ask");
    expect(js).toContain("setLocale");
  });

  test("memory pretty render + graph filter + fill layout", () => {
    expect(js).toContain("renderMarkdownHtml");
    expect(js).toContain("setMdBlock");
    expect(js).toContain("wiki-link");
    expect(js).toContain("/attachments/file?path=");
    expect(js).toContain("node-search-mode");
    expect(js).toContain("title_summary");
    expect(js).toContain("scene-fill");
    expect(js).toContain("browse-layout-nodes");
    expect(css).toContain(".scene-fill");
    expect(css).toContain(".md-block");
    expect(css).toContain(".node-search-mode-opt");
    expect(css).toContain("main:has(> .scene-fill)");
    expect(i18n).toContain("memory.nodes_filter");
    expect(i18n).toContain("標題＋摘要");
    expect(i18n).toContain("Title + summary");
    expect(js).toContain("browse-item-chain");
    expect(js).toContain("browse-item-preview");
    expect(js).toContain("browse-group-label");
  });
});
