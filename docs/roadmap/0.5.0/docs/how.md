# 0.5.0 HOW — UI 還原 Track

← [INDEX](../INDEX.md)

對照基準（唯讀）：`/path/to/engram/web/src/` — `App.tsx`、`Sidebar.tsx`、`ActivitiesScene.tsx`、`SeekScene.tsx`、`ClarifyScene.tsx`、`MemoryScene.tsx`、`styles/app.css`、`components/ui.tsx`（`MdBlock`）、`MentionComposer.tsx`。

## Track A — Vault 附圖與 Markdown（P0）

| 步驟 | 內容 |
|------|------|
| A1 | 模組 `server/vault-embeds.ts`：`normalizeAttachmentEmbedsInMarkdown(md)` — 將 `![](/api/attachments/file?path=…)`／`![](/attachments/file?path=…)` 轉成 `![[_attachments/uploads/…]]`；已是 wikilink 不動 |
| A2 | **Import**（0.4.0 腳本）：寫 chain／nodes `.md`、pool `raw` 前呼叫 A1 |
| A3 | **Distill skill** 文案：chain／node 正文只寫 wikilink embed，禁止烘焙 HTTP URL |
| A4 | **UI** `renderMarkdownHtml`：讀時支援 wikilink + legacy URL → `<img class="md-block-img">`；補 `![alt](url)`、基礎 GFM（連結、表格） |
| A5 | 測試：fixture markdown 虛構路徑；assert normalize 與 HTML 輸出 |

## Track B — 記憶場景（P1）

| 步驟 | 內容 |
|------|------|
| B1 | 去掉記憶 h1；mode／粒度 tab 改 button；CSS 抄 Engram `browse-index-card` 三列卡片、`browse-group-label` |
| B2 | `GET /chain?level=` → `{ ids, items: [{ id, preview?, start?, end? }] }`（preview 自 summary 首段機械截取，非 Pi） |
| B3 | 未來視列表：日期 + content preview 80 字；文案「長遠」對齊 Engram |
| B4 | 進入 mode 自動選第一則 + hash replace（與 Engram 一致） |

## Track C — 全站殼層

| 步驟 | 內容 |
|------|------|
| C1 | `index.html` + CSS：`.atmosphere`、`.app`／`.stage` 與 Engram 同層 |
| C2 | 側欄 foot：`status-light` + `GET /status` 映射（lock、queue、可選 l1 空否 — 依 Lite status JSON 能提供的欄位） |
| C3 | 事件／尋問／郵箱逐景對照 lead、tab icon、版面（無 dream_reports tab） |

## Track D — Mention 發帖

| 步驟 | 內容 |
|------|------|
| D1 | 移植 Engram `mentions.ts`／`MentionComposer` 行為到 vanilla（或最小依賴單檔） |
| D2 | `GET /nodes` 供候選；插入 `[[node|label]]` 或契約規定格式；發帖仍精確 `![[...]]` embed |
| D3 | 與 `POST /events` 對稱校驗一致 |

## 建議實作順序

A1→A2→A4→B→C→D（C 與 B 可並行）。

## 出貨

`version.md`、`changelog.md`、`AGENTS.md` 規劃表、`shell-ui.test.ts` 煙霧。
