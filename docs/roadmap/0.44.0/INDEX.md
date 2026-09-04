# 0.44.0 — 事件頁「近期入夢報告」

← [changelog](../../../changelog.md) · 上游：[0.43.0](../0.43.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**  
> **本版：** （1）事件頁第三 subtab **近期入夢報告**（只讀尚未 TTL 刪的 `committed` reports）；（2）修近期輸入區釐清已答卡：**多行答案須完整可見**（不得只顯示第一行）。**無** store migrate；boot 仍 ≥ **0.40**。  
> **開工前仍須拍板：無。**

## 產品句

> 自動 approve 之後，人仍能在事件頁翻最近幾場成功入夢的報告，直到 TTL 清掉檔案；不必去翻 store 目錄。近期頁已答釐清若有多行，要看得完，不能只露第一行。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作交接 |
| 1 | **本檔 INDEX** | 範圍、定案、Track、驗收 |
| 2 | [docs/how.md](./docs/how.md) | API 欄位、hash、UI 版面、preview 截斷、區（2）多行 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何第三 tab、為何只 committed、為何上下主從 |

相關：[0.43 TTL](../0.43.0/INDEX.md) · [GET /dreams/pending](../../../api-docs/api.md) · [0.36 事件雙 tab](../0.36.0/INDEX.md)

---

## 問題

預設 `dream_auto_approve=true` 時，成功路徑幾乎不停在 `pending_review`。「沉澱入夢」tab 只服務 **進行中／待審**；committed 的 `dreams/reports/{id}.md` 在 TTL 前仍在 staging，但工作台沒有入口。人要核對「剛沉澱了什麼」只能讀檔，違反「只打 HTTP API」。

---

## 已定案

### A. 產品／IA

| # | 題 | 決定 |
|---|-----|------|
| A1 | 位置 | 事件頁既有 tablist **之後**加第三 tab。順序固定：**近期輸入內容** → **沉澱入夢** → **近期入夢報告**。繁中標籤＝`近期入夢報告`；英文＝`Recent reports`。i18n 鍵 `events.tab_dream_reports`。 |
| A2 | 與沉澱分工 | 「沉澱入夢」**不變**：run／progress／pending 審核（approve／discard／retry／amend／involvements）。本 tab **唯讀**，**不**放入夢按鈕、**不**放審核操作。 |
| A3 | 誰進列表 | 僅 `DreamRunState.status === "committed"` **且** `dreams/reports/{id}.md` **仍存在**。含 `l1_clear_pending: true`（deploy 已成功，清 STM 失敗仍算成功入夢）。**排除：** `pending`、`discarded`、`superseded`；無 yaml 的孤兒 md；report 已 TTL 刪。失敗 job、未寫出 pending 的 extract **不**列。 |
| A4 | 壽命 | **不**新開 retention 鍵。列表＝cleanup 尚未刪的 committed reports（預設 `dream_committed_report_retention_days=7`；`-1`＝直到人手清）。過期消失＝正確，不當錯誤。 |
| A5 | Hash | 新 scene id **`dream_reports`**。`#/dream-reports` 開本 tab（無選中或僅自動選最新）。`#/dream-reports/{id}` 開本 tab 並選該 run（id 與既有 `dream_run_id` 同形；不安全字元仍用現有 `encodeHashId`）。左欄「事件」在 `activities`／`consolidate`／`dream_reports` 皆為選中。未知 hash 仍回事件（現況）。 |
| A6 | 深鏈缺檔 | hash 指向已刪或不存在／非 committed 的 id：tab 仍開、列表照常；讀者區空態（「這份報告已不在」）；**不要** 404 整頁。 |
| A7 | 入夢後不跳轉 | 自動／手動 approve **不**自動切到本 tab。人自己點。 |
| A8 | 發帖區 | 事件頁上方 compose **仍在**（三個 tab 共用），與 0.36 一致。 |

### B. API

| # | 題 | 決定 |
|---|-----|------|
| B1 | List | **`GET /dreams/reports`**：200 `{ "items": [] }` 若空（不是 404）。無 query／分頁；多餘 query 忽略。新→舊（`committed_at` 降序；缺則 `created_at`；同分 `id` `localeCompare` 升序）。extract／deploy／`pending_review` **允許** GET（永不 `409 dream_locked`）。 |
| B2 | List 欄位 | 每筆至少：`dream_run_id`、`created_at`、`committed_at`（字串；缺則仍給 ISO 或與 yaml 一致的值）、`patch_count`（number）、`l1_clear_pending`（boolean，缺 yaml 鍵則 `false`）、`narrative_preview`（見 HOW；**不要**整份 report）。**不要**回 draft 路徑、input snapshot、involvements 陣列。 |
| B3 | 單筆 | **`GET /dreams/reports/{id}`**：committed 且檔在 → 200 `{ "present": true, "dream_run_id", "created_at", "committed_at", "patch_count", "l1_clear_pending", "report" }`（`report`＝整份 markdown 字串，與 pending 的 `report` 同質）。否則 **200** `{ "present": false }`（含 pending／discarded／無檔／未知 id）。**不要** 404。 |
| B4 | 與 pending | `GET /dreams/pending` **不變**。Pending 報告只在沉澱 tab。 |
| B5 | 寫入 | 本版 **無** POST／PUT／DELETE reports。 |
| B6 | 根目錄 | `GET /` endpoints 加 `"GET /dreams/reports"`、`"GET /dreams/reports/:id"`（或專案既有 path 寫法）。 |

### C. UI

| # | 題 | 決定 |
|---|-----|------|
| C1 | 版面 | **同一事件欄寬**（不為本 tab 改成全寬 admin）。tabpanel 內 **上下主從**：上＝可捲列表；下＝選中報告全文（`MdBlock`）。**不要**做成提問郵箱那種左右兩欄（欄寬不夠讀長文）。列表 **渲染 API 回傳的每一筆**（無 UI 筆數帽、無虛擬「只顯示前 N 場」）；14–40% 高度只是 **視窗**，多出來的在列表內捲動，不是丟列。細節見 HOW。 |
| C2 | 列表列 | 可見：`committed_at`（或回退 `created_at`）、`narrative_preview` 截斷、可選一行次要 `dream_run_id`。`l1_clear_pending` 為 true 時用既有沉澱／status 文案標一句（勿新造產品詞）。 |
| C3 | 選取 | 點一列 → GET 單筆 → 下方展示 `report`。進 tab 時若 hash 無 id： **自動選最新一筆**（有則 replace hash 為該 id，避免「看起來沒內容」）。點列用 **push** hash。 |
| C4 | 空列表 | 書面語空態（沒有尚未清理的成功報告）。不當錯誤、不自動入夢。 |
| C5 | 刷新 | 與其他事件 tab 一樣有 refresh；重抓 list；若選中 id 已消失則走 A6。 |
| C6 | 禁止 | 在本 tab 解析／摺疊 report 各 `##` 成自訂 widget；顯示 yaml／input.json；列出 discarded。 |

### D. 近期輸入：釐清已答多行被裁

| # | 題 | 決定 |
|---|-----|------|
| D1 | 現象 | 事件頁「近期輸入內容」區（2）提問郵箱已答卡：`kind: prompt` 的 **答**（第二個 `MdBlock`）多行時畫面只見 **第一行**（問句卡可換行）。`kind: aside` 的 `answer` 若同樣被裁，一併修。 |
| D2 | 應有行為 | 答的全文（含硬換行與長句自動折行）都要看得見。卡隨內容長高；僅當超過既有 `.md-block` 的 `max-height: 28rem` 才在 **該塊內** 捲。禁止：`white-space: nowrap`、`line-clamp: 1`、固定單行高度、靠幾乎看不見的 scrollbar 把其餘行藏住。 |
| D3 | 同源 | 區（1）STM `raw` 若同一套樣式也只露一行，**同一修**，不要只打 aside／prompt 其中一種。 |
| D4 | 契約 | **不**改 `GET /memories/clarify/pending` 欄位。先確認 JSON `answer` 已是全文（`extractSection` 應吃整段 `## Answer`）；若 API 已全文則只修 UI／CSS。 |
| D5 | 隱私 | 測試與文件只用 **虛構** 多行。**禁止**把 live pending 正文寫進 roadmap／測試註解。 |

---

## 非目標

- 改 auto-approve、approve／discard／TTL／cleanup 鍵或行為
- 在沉澱 tab 自動貼上「剛批准的 report」（人要看歷史用第三 tab）
- Discarded／superseded／pending 歷史瀏覽器
- Report 搜尋、分頁、永久 archive 進 `memories/**`
- Store migrate、抬 boot gate
- 設定 GUI
- Vector search、記憶鏈橫向 strip、shared Zod（仍 backlog）

---

## 實作軌道

### Track A — API

- **做：** list／get；只 committed＋檔在；preview 規則；api.md；unit／窄測。
- **不要做：** 改 pending／cleanup。
- **驗收：** 空 200 `items: []`；committed 有檔出現；discarded 不出現；無檔 `present: false`。

### Track B — Hash＋事件第三 tab 殼

- **做：** `SceneId`／`parseHash`／Sidebar 高亮／`EventsFeed` 第三鈕；`#/dream-reports` 與 `#/dream-reports/{id}`。
- **不要做：** 改記憶頁 hash。
- **驗收：** 三 tab 可切；舊 `#/consolidate` 仍開沉澱；左欄事件在第三 tab 仍選中。

### Track C — 報告 UI

- **做：** 上下主從＋MdBlock＋i18n。
- **不要做：** 審核按鈕。
- **驗收：** 點列出全文；hash 深鏈可選中。

### Track D — 釐清已答多行＋出貨

- **做：** 修區（2）（必要時區（1））多行可見；HOW 所述 overflow／CSS；虛構多行手驗；workbench／version／changelog／AGENTS；INDEX → shipped。
- **不要做：** 改 pending JSON 形狀；把真人答句貼進測試。
- **驗收：** 多行答可見第二行與折行；`test:phases` 全綠。

---

## 驗收

- [x] `GET /dreams/reports` 空為 200 `{ "items": [] }`
- [x] 僅 `committed` 且 report 檔仍在者出現；`discarded`／`superseded`／`pending` 不出現
- [x] `l1_clear_pending: true` 的 committed **有**出現
- [x] list **無**完整 `report`；有 `narrative_preview`
- [x] `GET /dreams/reports/{id}` 成功為 `present: true`＋`report`；否則 200 `present: false`
- [x] 事件頁第三 tab 在沉澱之後；標籤繁中「近期入夢報告」
- [x] `#/dream-reports`／`#/dream-reports/{id}` 工作；左欄事件高亮
- [x] 選一列下方為 markdown 全文；空列表有空態
- [x] 沉澱 tab 行為與 0.43 等價（仍可入夢／待審）
- [x] 區（2）虛構多行 `answer`（含換行）可見全文，不是只第一行
- [x] `bun run test:phases` 全綠
- [x] 無 migrate；boot ≥0.40
- [x] 出貨：`version.md`／changelog＝0.44.0

## 與上一版對照

| | 至 0.43 | 0.44 |
|--|---------|------|
| 事件 subtab | 近期輸入、沉澱入夢 | ＋近期入夢報告 |
| 讀 committed report | 無 HTTP list | `GET /dreams/reports`＋`/{id}` |
| auto-approve 後看報告 | 只能讀 staging 檔 | 工作台唯讀 tab |
| 區（2）多行答 | 只見第一行（bug） | 全文可見 |
| TTL | 7 天（不變） | 不變；UI 只反映尚未刪的檔 |

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/store/dreams/dream-runs.ts` | `listDreamRuns`、status、`reportPath` |
| `server/src/index.ts` | 掛路由 |
| `docs/api-docs/api.md`、`docs/api-docs/README.md` | 契約 |
| `web/src/lib/hashRoute.ts`、`web/src/lib/types.ts`、`web/src/App.tsx` | scene／hash |
| `web/src/scenes/ActivitiesScene.tsx`、`web/src/components/Sidebar.tsx` | 第三 tab；區（2）MdBlock |
| `web/src/styles/app.css`（`.md-block`、`.stm-entry`、`.clarify-pending-question`） | 多行裁切 |
| `web/src/components/ui.tsx` | `MdBlock` |
| `web/src/scenes/SeekScene.tsx`（recent asks 列表樣式可參考，**不要**回填表單） | 列表互動參考 |
| `web/src/i18n/zh-Hant.json`、`en.json` | 標籤 |
| `.agents/skills/engram-workbench/` | 操作說明 |
| `server/src/cli/self-test.ts` | 可選 phases curl |
