# 0.6.0 — 工作台殼收口、節點活躍分、匯入指引

← [changelog](../../../changelog.md) · 上游：[0.5.0](../0.5.0/INDEX.md) · current: [version.md](../../../version.md) · [GUIDELINES](../GUIDELINES.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

> **狀態：** **shipped**（2026-09-25）  
> **產品句：** 收 [0.5.0](../0.5.0/INDEX.md) 延後的 **殼層**（狀態燈、atmosphere、`@` mention 驗收）、落地 **節點活躍分** 讀取與 UI，並在文件與 import 腳本上支援 **Engram 離線匯入**（含 score 快照）；**不**在 server／distill 實作打分或 consolidate 涉入。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、驗收 |
| 2 | [docs/how.md](./docs/how.md) | Track A–E |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 活躍分為何 frontmatter、distill 不維護 |
| 4 | [HANDOFF.md](./HANDOFF.md) | paste-ready |

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 殼層 | `.atmosphere` 裝飾層（冷色紙面漸層，不阻擋點擊）；`workspace` 在 Pi job **queued／running** 或本頁 `actionLock` 時加 `.stage-locked`（視覺 dim + 維持 `data-lock` 禁用） |
| 2 | 狀態燈 | 側欄 `.sidebar-foot` 內 `.status-light` + `.status-label`；輪詢／路由時讀 `GET /status`：`queue != null` → **忙碌**（琥珀）；否則 **就緒**（綠）。文案 i18n `status.ready`／`status.busy`／`status.busy_kind` |
| 3 | Mention | 沿用 `web/mention-composer.js`；插入 `[[nodes/{id}/{id}|title]]`；本版驗收勾選並自 backlog 移除 |
| 4 | 活躍分儲存 | **Vault**：node 主檔 `memories/nodes/{id}/{id}.md` 可選 YAML frontmatter 欄位 **`activity_score`**（整數 0–100）。**不**新增 `score.yaml` 持久化格式；Engram 來源若存在 `nodes/{id}/score.yaml`，**僅 import** 時機械合併進 frontmatter 後可刪旁檔或保留（import 以寫入 frontmatter 為準） |
| 5 | 活躍分讀取 | `listNodes`／`readNode` 解析 frontmatter；`GET /nodes` 項增 optional `activity_score`；`GET /nodes/{id}` 同。無欄位或非法 → 省略／`null`，**不** 404 |
| 6 | 活躍分 UI | 節點詳情 `#detail-meta` 顯示 Engram 式「活躍分 n / 100」；無分數顯示 `—`（i18n `memory.score_none`）。**不**在圖上畫分數、不做列表排序 |
| 7 | Distill／server | **不**維護、不計算 `activity_score`；skill 不必改寫作規則。使用者手改 vault 或 import 快照為唯一來源 |
| 8 | 真人匯入 | **操作**在倉庫外新目錄：`bun run import:engram --from <engram-store> --to <lite-store>`（dry-run → `--yes`；非空 `--force`）。HOW 寫檢查清單；**禁止**把真人正文寫進 repo／測試。本版不改匯入範圍（chain／nodes／pool 等仍 0.4.0）除 **score.yaml→frontmatter** 後處理 |
| 9 | 尋問 scope 細節 | **非目標**（仍 backlog 可選）；本版不做 |

## 非目標

- React／Vite；dream report UI
- Server 規則引擎或 distill 自動更新活躍分
- `GET /nodes/graph` 帶 score、節點列表依分數排序
- 在本機替使用者執行真人 vault 匯入（僅文件與腳本能力）

## 驗收

- [x] `.atmosphere` 存在且 `shell-ui`／CSS 煙霧
- [x] 側欄狀態燈反映 `GET /status.queue`；job 進行中 workspace `.stage-locked`
- [x] `@` mention 下拉可選節點並插入 wikilink；`mention-composer.js` 已載入
- [x] 虛構 node fixture 含 `activity_score`；API 與節點詳情 UI 顯示 `n / 100`；無分數顯示 `—`
- [x] import 測試：虛構 `score.yaml` 合併進 frontmatter
- [x] `docs/data-spec.md`、`docs/api.md` 同步 `activity_score`
- [x] HOW／data-spec 含真人匯入檢查清單
- [x] `bun test` 全綠；`version.md`＝`0.6.0`、`changelog.md`；清 backlog

## 錨點

`web/index.html`、`web/style.css`、`web/app.js`、`web/mention-composer.js`、`web/i18n.js`、`server/store.ts`、`server/node-score.ts`（新）、`server/index.ts`、`scripts/import-from-engram.ts`、`server/shell-ui.test.ts`

← [0.5.0](../0.5.0/INDEX.md) · [backlog](../backlog/INDEX.md)
