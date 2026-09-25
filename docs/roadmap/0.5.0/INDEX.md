# 0.5.0 — Engram 工作台 UI 還原（無入夢報告）

← [changelog](../../../changelog.md) · 上游：[0.4.0](../0.4.0/INDEX.md) · current: [version.md](../../../version.md) · [GUIDELINES](../GUIDELINES.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

> **狀態：** **shipped**（2026-09-25；記憶 UI 與 import 一併出貨；殼層剩餘見 [0.6.0](../0.6.0/INDEX.md)）  
> **產品句：** 靜態 `web/` 殼層與四景（事件／尋問／提問郵箱／記憶）在**視覺與互動**上對齊完整 Engram；**不**引入 React／Vite；**不**還原入夢報告 tab 與 dream review 流程。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、驗收 |
| 2 | [docs/how.md](./docs/how.md) | Track、對照 Engram 路徑、實作順序 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何仍用 vanilla JS、何時允許讀時轉換 |
| 4 | [HANDOFF.md](./HANDOFF.md) | paste-ready |

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 範圍 | **全站**還原：側欄（含狀態燈）、事件（含 `@` mention composer）、尋問（scope／近期提問 UX）、提問郵箱、記憶三 mode；對照 `engram/web/src/` |
| 2 | 非目標 | `#/dream_reports`、Consolidate 待審／amend／re-dream UI；server 仍 **POST /distill** 薄管線 |
| 3 | 記憶殼 | 僅 `scene-lead`（無場景內 h1「記憶」）；記憶鏈｜節點｜未來視 **button** tab；鏈／未來視左欄 **卡片網格 + preview**；`GET /chain` 增 **preview**（及 week **range**） |
| 4 | Markdown | Vault 正文**只**持久化 `![[_attachments/uploads/{日}/{檔}]]`（Obsidian 自然顯示）；UI 可**讀時**相容 legacy `![](/api/attachments/file?path=…)`，但 import／distill **寫回**須正規化為 wikilink（見 [0.4.0 HOW](../0.4.0/docs/how.md) 與 `docs/data-spec.md`） |
| 5 | 渲染 | 對齊 Engram `MdBlock` 能力子集：GFM 圖片、連結、表格、blockquote、程式碼；圖 CSS `max-width: min(100%, 36rem)` |
| 6 | 殼層 | `.atmosphere`、`stage-locked` 滿版；側欄 **status light**（`GET /status` 既有欄位映射 Engram 文案） |
| 7 | 事件 | **MentionComposer** 行為對齊 Engram（`@` 節點、embed 插入精確 wikilink）；仍 `POST /events` 機械寫入 |
| 8 | 節點活躍分 | **本版不做** → [backlog：節點活躍分](../backlog/node-activity-score.md) |

## 非目標

- React／Vite  toolchain
- Dream report 列表與詳情
- Engram `display_score` API（無資料模型前不造假 UI）
- Server 語意規則引擎（仍 skill 寫 vault）

## 驗收

- [x] 記憶鏈左欄與 Engram 同級：id + preview（+ 週 range）；`GET /chain` `items`
- [x] 日記正文含 wikilink 附圖；legacy `![](/api/attachments/…)` 讀時相容；vault 正規化見 0.4.0
- [x] 記憶殼：僅 scene-lead、卡片網格、未來視 preview／長遠分組；鏈點選委派修復
- [x] `docs/data-spec.md` 附圖與匯入指標
- [x] `version.md`＝`0.5.0`（出貨時）
- [x] 側欄狀態燈、`@` mention、`.atmosphere` → [0.6.0](../0.6.0/INDEX.md)
- [ ] 完整 GFM（表格等）→ 按需 backlog

## 錨點

`web/app.js`、`web/style.css`、`web/index.html`、`web/i18n.js`、`server/index.ts`、`server/store.ts`、`server/vault-embeds.ts`（或同職責模組）、`scripts/import-from-engram.ts`

← [0.4.0](../0.4.0/INDEX.md) · [backlog](../backlog/INDEX.md)
