# 0.5.0 — Cleanup + memory-chain 雙軌 + Web i18n

← [changelog](../../changelog.md) · 上游：[0.4.1](../../version.md) · current: [version](../../version.md)

> **狀態：** **已落地** — Track A／B／C 均已寫入程式；見 `version.md`／`changelog.md` 0.5.0。  
> **本版做：** memory-chain **ledger + summary** 雙軌；**Web UI i18n**（僅介面殼層）；**cleanup**（時區可設定、熱路徑 I/O、依賴瘦身、event id、fixture 移除等）。  
> **本版不做：** week/month rollup、node merge、Recall 注入 future-sight、**記憶內容**翻譯。

## 產品句

> 每個 occurrence day 同時保留 **不可變增量 ledger**（patch block append）與 **可融合日摘要 summary**（extract 產出、approve 機械寫入）；Recall 讀 summary，稽核讀 ledger。Workbench UI **僅支援 English／繁體中文** 切換，不改動 L1／L2／chain 原文。執行時日曆與時間戳由 **`ENGRAM_TZ`**（預設 `Asia/Hong_Kong`）決定。

## 文件地圖

| 文件 | 內容 |
|------|------|
| [docs/chain-dual-track.md](./docs/chain-dual-track.md) | 路徑、patch 欄位、dream 流程、recall、遷移、手改政策 |
| [docs/web-i18n.md](./docs/web-i18n.md) | UI-only i18n 範圍、語系、實作方向、與記憶內容邊界 |

## 已定案（2026-07-22）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 檔案佈局 | `memory-chain/days/{id}.md` = **ledger**；`memory-chain/days/{id}.summary.md` = **summary** |
| 2 | Ledger 寫入 | 維持現行 **append-only** patch block（`<!-- patch:… -->` 冪等） |
| 3 | Summary 寫入 | **只在 extract** 產出 `summary`；`materialize`／`commitDraft` **機械** revise；commit 時 **不**再跑第二輪 AI |
| 4 | Summary 結構 | 對齊 L2：`## Current` + `## History`；`summary_operation`: `init` \| `revise` |
| 5 | 一筆 `chain` patch | 同時驅動 ledger append + summary revise（單 patch 雙欄位，見子文件） |
| 6 | Extract context | 必帶目標日的 **summary Current**；ledger 可選（人審／debug） |
| 7 | 空 summary | 首次 chain 該日用 `init`；Recall 無 summary 時 **fallback** 讀 ledger（過渡期） |
| 8 | 手改 summary | **允許** user 直接改檔；正常流程僅經 dream；**不**做衝突偵測——靠 user 紀律，勿與 dream lock 期間並行手改 |
| 9 | Recall | 預設注入 **summary**；ledger **不**進 packet |
| 10 | 遷移 | 既有 `days/*.md` **不搬**；視為 ledger；summary 由下一輪 dream 或一次性 backfill 產生 |
| 11 | `future_chain_id` | 維持；ledger／summary 皆受 occurrence 日校驗 |
| 12 | Cleanup | 見下方 **Track C**（已落地清單） |
| 13 | Web i18n | **僅 UI 殼層**；**僅兩語**：English（`en`）+ **繁體中文**（`zh-Hant`，預設）；見 [web-i18n.md](./docs/web-i18n.md) |
| 14 | 記憶內容語言 | **不**做 i18n／translate；report、recall packet、L1/L2/chain 原文照顯示 |
| 15 | 0.4.0 commit | 釋出前整理 0.4.0／0.4.1 混雜變更並補 commit（release hygiene） |
| 16 | 用語 | **operator** → **workbench**；skill 目錄 `engram-workbench`；Recall 中文 **回憶**（不用「召回」）；見 `domain-language.md` |
| 17 | 時區 | **`ENGRAM_TZ`**（IANA）；預設 **`Asia/Hong_Kong`**；`/status` 暴露 `timezone`；helpers `calendarDate`／`nowIso` |

## 非目標（本版）

- `memory-chain/weeks|months|years` 關帳 rollup
- Node merge／融合
- Commit 時 AI 二次融合 summary
- Dream 與手改 summary 的 optimistic locking
- 記憶內容、dream report、API 錯誤訊息的自動翻譯
- **第三語系**（含簡體中文）、RTL、server／CLI i18n

## 實作軌道（落地狀態）

**Track A — chain 雙軌** ✅

1. 契約 → `api-docs/api.md`
2. `ChainPatch` schema + `parsePatch` + extract prompt
3. Extract context：`chain_summaries_current`（+ 可選 ledger）
4. `applyChainToDraft` 拆 ledger／summary；draft manifest 追蹤 `.summary.md`
5. `readDaySummary` + `GET /recall` 讀 summary（fallback ledger）；`chain.source`
6. Report／pending `draft_summary.chain_summary_days`
7. Mock agent + `test:phases`（不再依賴 `fixture:apply`）
8. `domain-language.md` 補 **ledger**／**summary**

**Track B — Web i18n** ✅

1. `web/i18n/{zh-Hant,en}.json` + `i18n.js`（靜態 import；Bun 不服務裸 JSON）
2. 抽離 `index.html`／`app.js` UI 字串；產品域中文：記下／沉澱／回憶／入夢
3. Topbar 語言切換 + `localStorage` `engram.locale` + `document.lang`
4. Status poll：lock **5s**／`pending_review` **20s**／idle **60s**

**Track C — cleanup／infra** ✅（原「實作時再列」；已落地如下）

| 項 | 內容 |
|----|------|
| 時區 | `ENGRAM_TZ`；預設 `Asia/Hong_Kong`；去掉硬編碼 `Asia/Taipei`／`taipei*` helpers |
| Event id | `e` + **10** 位零填（例 `e0000000001`）；`nextEventId` 用 `wc -l` |
| 熱路徑 I/O | DLQ count／`isL1Empty` → `wc -l`；patches by run → `grep -F`；extract 事件取自 L1 scope（不掃整份 L0） |
| YAML | 移除 npm `yaml`；改 `server/src/yaml.ts`（Bun 內建 `YAML`） |
| TypeScript | `typescript` ~7；`tsconfig` 去掉 deprecated `baseUrl`／`paths` |
| Fixture | 移除 `fixture:apply` 與 `server/fixtures/`；機械自測以 `bun run test:phases` 為主 |
| Docs／註解 | API／README／AGENTS 對齊；server 模組與主要 export 補責任註解 |

**收尾**

- bump `version.md` → `0.5.0`；changelog 記完整範圍
- 0.4.x release commit（hygiene，可另 PR）

---

**狀態：** shipped — 見 `version.md` 0.5.0
