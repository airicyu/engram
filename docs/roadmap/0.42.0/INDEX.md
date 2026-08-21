# 0.42.0 — 近期輸入內容展示未入夢釐清

← [changelog](../../../changelog.md) · 上游：[0.41.0](../0.41.0/INDEX.md)（in progress）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md) · 構想：[backlog](../backlog/INDEX.md)

> **狀態：** **shipped**  
> 事件頁「近期輸入內容」除短期記憶事件外，列出 live `clarify/pending/`（已答補問＋順帶補充），讓人看見下輪入夢才會蒸餾的釐清輸入。新增 `GET /memories/clarify/pending`。**無** store migrate；boot 仍 ≥ **0.40**。  
> **開工前仍須拍板：無。** 設計審查 H1、M1–M6 已併入本 INDEX 與 HOW（見 [design-review](./docs/design-review.md)）。

## 產品句

> 人在「近期輸入內容」能同時看到尚未入夢的事件，以及提問郵箱已答／順帶補充、正等下一場夢記入記憶層的內容。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作交接、starter prompt |
| 1 | **本檔 INDEX** | 範圍、定案、Track、驗收 |
| 2 | [docs/api-and-ui.md](./docs/api-and-ui.md) | GET wire、兩區版面、空態、i18n 句 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何掛近期頁、為何含 aside |
| 4 | [docs/design-review.md](./docs/design-review.md) | 初審；H1／M1–M6 **已併入**；衝突時 **INDEX 勝** |

相關：[0.30 釐清](../0.30.0/INDEX.md) · [0.36 事件頁 IA](../0.36.0/docs/ia.md) · [0.41 釐清快照](../0.41.0/INDEX.md) · [api.md clarify](../../../api-docs/api.md)

---

## 問題

Submit／aside 後內容在 `pending/`，下輪 distill 會讀；提問郵箱只列 asking，近期頁只列 pool，人在 UI 上看不到「已經交給系統、等入夢」的釐清。

---

## 已定案

### A. 產品位置

| # | 題 | 決定 |
|---|-----|------|
| A1 | 掛哪 | 事件頁內 tab **「近期輸入內容」**（hash 仍 `#/`／`#/activities`）。**不要**第五左欄、**不要**在提問郵箱做已答匣。 |
| A2 | 兩區 | tab 面板內**分兩區、不要混成一條時間軸**。（1）近期輸入的事件＝現有 STM feed；（2）提問郵箱已答、尚未入夢＝live pending。區（1）在上、區（2）在下。 |
| A3 | 郵箱頁 | 仍只 `GET /memories/clarify/asking`；submit／dismiss／aside 行為不變。成功後該則從郵箱列表消失，改到近期區（2）可見。 |
| A4 | 文案語意 | 區（2）表示 **live pending、留給之後某場夢的 distill**（0.41：若一場夢已在跑，開跑後才寫的 pending **不**進本場快照）。**禁止**寫成「正在進行的這場夢一定會吃到」。 |
| A5 | Hash | **不**新增 `#/activities/pending/{id}` 等深鏈。 |

### B. 列出什麼

| # | 題 | 決定 |
|---|-----|------|
| B1 | pending 來源 | 只讀 live `memories/clarify/pending/`。含 `kind: prompt`（submit 的問＋答）與 `kind: aside`（順帶補充；`question` 為 null，正文在 `answer`）。 |
| B2 | 不列 | dismiss（從未進 pending）；`history/`（approve 已歸檔）；asking（未答）。 |
| B3 | 消失時機 | approve 把本場釐清快照∩仍在 pending 者移入 history 後，區（2）不再列出那些 id。Discard／amend **不**歸檔 pending（既有契約），故區（2）仍顯示。Retry 既有行為不變。 |
| B4 | 空態 | 兩區**獨立**空態。pool 空**不得**整頁只顯示舊的單一 STM 空文案而把區（2）藏掉。兩區皆空時仍顯示兩個小標＋各自空句。 |
| B5 | 操作 | 區（2）**唯讀**。不在此 submit／dismiss／刪 pending／改答。寫入仍走郵箱頁與事件 composer。 |
| B6 | 載入／刷新 | **進入近期 tab**、點 refresh、**發帖成功後既有 `refreshL1` 路徑**（含 `Promise.all` 裡那次）：三者都重抓 STM **與** pending。禁止只改 refresh 按鈕。兩區 **分開 state**（一區 GET 失敗不得清空另一區已載入資料）。 |

### C. API

| # | 題 | 決定 |
|---|-----|------|
| C1 | 端點 | **`GET /memories/clarify/pending`**。空 → **200** `{ "items": [] }`（不是 404）。**無** query、**無**分頁／cursor／limit：列出**全部** live pending（與 asking GET 同型）。多餘 query **忽略、不要 400**。上限／虛擬捲動＝非目標。 |
| C2 | 欄位 | 每則：`id`、`kind`（`prompt`｜`aside`）、`created_at`、`answered_at`、`source_dream_run_id`（可 null）、`related_nodes`、`question`（aside＝`null`）、`answer`。對齊 store `ClarifyPendingItem`。 |
| C3 | 排序 | **新→舊**：`answered_at` **降序**；同分 `id` **升序**（`localeCompare`）。aside 的 `answered_at` 等於寫入時戳（既有 store）。**不要**改 pipeline 用的 `listPendingItems()` 排序（distill／快照仍用現有 oldest→newest／現況函式）。 |
| C4 | 鎖 | 讀取**不**拿 `withClarifyWriteLock`（與 `GET asking` 相同）。extract／deploy／`pending_review` **允許** GET；**不得**因 `dream.lock` 回 409。 |
| C5 | 寫入 | **不**新增 POST／PATCH／DELETE pending。 |
| C6 | 根目錄 | `GET /` 的 endpoints 陣列加上該 path。 |
| C7 | Migrate | **無**；boot 仍 ≥ **0.40**。 |

### D. UI 呈現

| # | 題 | 決定 |
|---|-----|------|
| D1 | 事件區 | 維持現有 STM 卡片（新→舊、`MdBlock` raw）。排序規則不要另發明。 |
| D2 | 釐清區 | `prompt`：先問後答；`aside`：標順帶補充、只顯示 `answer`。時間用 `answered_at`。可用與 STM 相近的 article／meta（含 **id**）。正文走 `MdBlock`。區（2）**不展示** `source_dream_run_id`、`related_nodes`（JSON 仍回，給 skill／除錯）。非法 `kind`：當 skip，或標「釐清」且只渲染 `answer`；**不當成** STM 事件卡。 |
| D3 | i18n | 鍵與正文鎖在 [api-and-ui.md](./docs/api-and-ui.md)。繁中書面語。**禁止**含「正在入夢」「本場夢」「這次會寫入」。 |
| D4 | 入夢中 | 0.41：近期頁仍可發帖；區（2）顯示 **live** pending（含本場開跑後新答的），不必等夢結束。 |

---

## 非目標

- Dismiss 黑名單；改 `clarify_generate` 選材／最低則數
- `GET /memories/clarify/history`；郵箱頁已答列表
- 改 distill／approve 歸檔／0.41 快照語意
- 把釐清 uuid 塞進 activity `scope[]`
- 在近期區編輯／撤回 pending
- 新 hash、第五左欄、記憶鏈 UI、store migrate、抬 boot
- 合併兩區為單一時間軸
- pending 列表分頁／limit／虛擬捲動

---

## 實作軌道

### Track A — API

- **做：** `handleClarifyListPending`；註冊 `GET /memories/clarify/pending`；根 endpoints 列表；`listPendingItems` 可複用讀檔，**排序只在 handler／專用 list**。`docs/api-docs/api.md` 同步。
- **不要做：** 改 submit／aside／archive；改 dream pipeline。
- **驗收：** 空 200 `items: []`；submit 後該 id 在 pending、不在 asking；aside 在 pending 且 `kind: aside`、`question: null`；dismiss 的 id 不在 pending。

### Track B — UI

- **做：** `ActivitiesScene` 近期 tab 兩區；`web/src/lib/api.ts` 加 `ClarifyPendingItem`（對齊 C2）與 `listPending()`；i18n 用 HOW 鎖死句子／適量 CSS。進 tab／refresh／發帖成功 refresh 皆 STM＋pending。
- **不要做：** 改 ClarifyScene 契約（除既有 refresh 後列表變空，無需新端點）。
- **驗收：** 打開近期 tab（不點 refresh）可見已有 pending；pool 空、pending 有資料時區（2）仍可見；STM GET 失敗時區（2）已載入資料仍在；兩區皆空見兩個空態。

### Track C — skills／phases／出貨文件

- **做：** `engram-workbench` 的 **SKILL.md、api-reference.md、workflows.md、scripts/engram-api.sh** 皆加 `clarify-pending`（勿只改一支）。`self-test`／phases：submit／aside／dismiss；approve 歸檔後 id 不在 pending；**extract／dream lock 期間 GET pending → 200**（可接既有 lock×aside 段）。出貨：version／changelog／AGENTS；`docs/domain-language.md` Clarify 表加一句「事件頁近期區（2）＝ live pending」。
- **不要做：** activities-integration 改寫入契約。
- **驗收：** `cd server && bun run test:phases` 全綠。

---

## 驗收

- [x] `GET /memories/clarify/pending` 空為 200 `{ "items": [] }`
- [x] submit 後 asking 無該 id、pending 有問＋答；aside 在 pending；dismiss 不在 pending
- [x] 打開近期 tab（不點 refresh）即可見已存在的 pending；兩區獨立；事件空不隱藏釐清區；STM GET 失敗不清空區（2）
- [x] 郵箱頁仍只列 asking；無 history GET
- [x] approve 歸檔後對應 id 從 GET pending／區（2）消失（discard 則仍在）
- [x] extract／dream lock 中 GET pending **200**（不是 409）；phases 含此 assert
- [x] `bun run test:phases` 全綠
- [x] 區（2）i18n 不含「本場夢／正在入夢會寫入」
- [x] api.md、workbench SKILL／api-reference／workflows／helper、根 endpoints 已列新 GET
- [x] 出貨：`version.md`／changelog＝0.42.0；boot 仍 ≥0.40；刪 backlog 該條（見 GUIDELINES）

## 與上一版對照

| | 至 0.41 | 0.42 |
|--|---------|------|
| 近期 tab | 只 STM pool | STM ＋ live clarify pending |
| `GET` clarify pending | 無（0.30 非目標） | 有；空 200 |
| Distill／approve／快照 | 0.41 | **不變** |
| 提問郵箱 | 只 asking | **不變** |
| migrate／boot | ≥0.40 | ≥0.40 |

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/api/clarify.ts` | 加 list pending handler |
| `server/src/index.ts` | routes＋根 endpoints |
| `server/src/store/memories/clarify.ts` | `ClarifyPendingItem`、`listPendingItems`（勿改 pipeline 排序語意） |
| `web/src/scenes/ActivitiesScene.tsx` | 近期 tab 兩區 |
| `web/src/lib/api.ts` | `ClarifyPendingItem`＋`listPending` |
| `web/src/i18n/zh-Hant.json`、`en.json` | HOW 鎖死小標／空句 |
| `.agents/skills/engram-workbench/SKILL.md`、`api-reference.md`、`workflows.md`、`scripts/engram-api.sh` | 操作＋ helper `clarify-pending` |
| `docs/domain-language.md` | 出貨時 Clarify：近期區（2）＝ live pending |
| `web/src/styles/app.css` | 兩區樣式（克制） |
| `docs/api-docs/api.md` | 契約 |
| `server/src/cli/self-test.ts` | phases：含 lock 期間 GET pending 200 |
