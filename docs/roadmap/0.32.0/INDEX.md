# 0.32.0 — Activities `@` node mention composer（廢 `node_refs`）

← [changelog](../../../changelog.md) · 上游：[0.31.0](../0.31.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md) · 來源：backlog activity-node-mentions（已出貨刪除）

> **狀態：** **shipped**  
> **本版只做這一項：** Activities 捕捉改為 **`@` mention composer**（既有 node＝ref pill；尚無＝create intent）；capture／L0／dream 以 **`raw` 內嵌 mention token** 為關聯真相；**廢除** `node_refs`（新請求帶該鍵 → 400）。**無** store migrate；**不**抬 boot gate。Clarify／Seek **不**共用此 composer。

## 產品句

> 人在 Activities 用 `@` 選中既有 node 或宣告要新建誰；提交後 event 正文帶可解析 mention，入夢依此消歧／建 node，不再靠平行的 `node_refs` 陣列。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作 agent 開工交接 |
| 1 | **本檔 INDEX** | 範圍、定案、非目標、軌道、驗收 |
| 2 | [docs/mention-contract.md](./docs/mention-contract.md) | Token 形狀、API、解析、id 規則、dream 行為 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何正文真相、廢 `node_refs`、軟警告等 |

---

## 問題（本版要解決什麼）

1. Activities 只有純 textarea＋幾乎無人用的 `node_refs` 側車；同名實體靠散文猜，入夢易併錯。
2. `node_refs` 與敘事脫節，不自然；應用作文中的 mention 承載意圖。
3. 「尚未存在、但這則就要建 node」缺少顯式 **create intent**。

---

## 已定案

### A. UI（僅 Activities）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 場景範圍 | **只改 Activities** 主輸入。Clarify aside／Seek **不**共用 composer（本版） |
| 2 | Composer | 主輸入改為支援 pill 的 composer（可與 0.29 附件拖放／貼上並存） |
| 3 | 觸發 | 輸入 `@` → mention popover；鍵盤↑↓／Enter／Esc |
| 4 | 既有 node | 打字篩選（客戶端對 `GET /memories/nodes` index 做前綴／含字串濾；node 量小夠用）→ 選中＝插入 **ref** pill |
| 5 | 新建 | `@tommy` 後確認新建（Enter 在「新建」項，或同等）→ **create** pill；**若 id 已存在於 live index → 禁止 create**，提示改選現有或換 id |
| 6 | 廢 UI | 移除 Activities 上舊的 `node_refs` 文字欄／多選 |
| 7 | Submit | composer 序列化後的 `raw`（含 token）＋既有 `attachments[]` 規則；**不**再傳 `node_refs` |

### B. 正文 token（關聯真相）

| # | 題 | 決定 |
|---|-----|------|
| 8 | 真相 | **僅 `raw` 內嵌 token** 為 mention／create 的儲存與傳遞真相。本版 **不**新增必填 JSON 側車陣列（避免再造 `node_refs`） |
| 9 | Ref 形態 | `[@{label}](node:{id})`；UI 預設 `label === id`；`id` 為穩定 node id |
| 10 | Create 形態 | `[@{label}](node-create:{id})`；`id`＝使用者確認的新建 id（經 sanitize） |
| 11 | 解析 | Server／dream 從 event `raw` **解析**上述兩種 link；非法或不完整 token **不當** mention（保留原文） |
| 12 | 與附件 | `![[_attachments/…]]` 規則不變；mention link 與 embed **並存** |
| 13 | 與 Obsidian P1 | Activity `raw` **不**要求寫 `[[nodes/{id}/{id}\|…]]`；入夢寫 **L2／chain** 時仍依 0.28／0.31 用 P1。Activity token → dream 建／改 node 後，長期檔用 P1 |

精確文法與反例見 [mention-contract](./docs/mention-contract.md)。

### C. API／L0（廢 `node_refs`）

| # | 題 | 決定 |
|---|-----|------|
| 14 | 新請求 | `POST /activities` **若出現 `node_refs` 鍵**（不論值）→ **400** `node_refs_removed`（或同等明確 error code；訊息說明改用 raw mention token） |
| 15 | 舊 JSONL | 歷史 event 若仍含 `node_refs`：**讀取路徑忽略該鍵**；**不做** migrate／改寫舊檔 |
| 16 | Wire | 成功捕捉仍回 `201`＋`event_id`；body 必填仍為 `raw`；可選 `source`／`attachments` |
| 17 | Short-term | Pool 條目與 L0 一致存 `raw`（含 token）；廢除對 `node_refs` 的寫入與「由 node_refs 衍生 node notes」依賴——改由 **解析 raw mentions** 驅動任何「提及哪些 node」的預覽／上下文（若現行 short-term UI 有依 refs 分組，改為依解析結果或僅顯示 raw） |
| 18 | Store | **無** migrate hop；**不**抬 boot gate（仍 ≥0.28） |

### D. id 規則（create）

| # | 題 | 決定 |
|---|-----|------|
| 19 | Sanitize | create／ref 的 `id`：trim；禁止空白、`/`、`\\`、空字串；建議允許 `A–Z a–z 0–9 . _ -` 與非 ASCII 字母數字（與現行 node 資料夾名實務對齊）；細節見 mention-contract |
| 20 | 撞 id | **Create 時**若 `id` 已在 **live** `memories/nodes/`（或 index API 已知）→ UI 與（若繞過 UI 的）server 校驗：**拒絕該 create**（UI 擋；API：若 raw 含 `node-create:{id}` 且 id 已存在 → **400** `mention_create_exists`） |
| 21 | 改成 ref | **不**自動把撞車的 create 改成 ref；人必須明確選現有 pill |

### E. Dream

| # | 題 | 決定 |
|---|-----|------|
| 22 | Context | Frozen／extract context 對 scope 內 events **附上解析後的 mentions**（`ref`／`create` 列表）；prompt（dream-files／extract）要求：`create` → 本輪 **應** seed `nodes/{id}/{id}.md`；`ref` → 提及時對齊該 id（寫 Relation／chain 時用 P1） |
| 23 | 漏建 | 若 `create` 名單在 draft 未出現對應主檔 → **Structure notes（或 report 同等段）軟警告**；**不**因此失敗 dream job、**不**擋 approve（對齊 soft lint 風格） |
| 24 | Mock／phases | Mock 路徑：含 `node-create:` 的 capture → approve 後 live 存在該 node 主檔；含 `node:` ref → context／行為可測；`POST` 帶 `node_refs` → 400 |

### F. 整合方

| # | 題 | 決定 |
|---|-----|------|
| 25 | activities-integration skill | 更新：刪 `node_refs`；改文档／範例為 raw mention token；changelog 標 breaking |
| 26 | 外部 bot | 無 UI 時直接在 `raw` 寫入 `#9`／`#10` 形態即可 |

---

## 非目標

- Clarify／Seek 共用 composer
- Node rename／merge UI
- Activities 內編輯 live `{id}.md`
- 歷史 events 回填 mention／剝除舊檔 `node_refs` 的 migrate
- Vector mention 搜尋（仍先客戶端濾 nodes index）
- Graph GUI
- 長期兼容層「接受 `node_refs` 並轉寫」

---

## 實作軌道

### Track A — API／store：廢 `node_refs`＋解析 mentions

- **做：** `POST /activities` 拒 `node_refs`；L0／short-term／dream context 改解析 raw；錯誤碼；phases 調整
- **不要做：** migrate 掃全庫改 JSONL
- **驗收：** 帶 `node_refs` → 400；純文字 capture 仍 201；含 token 的 raw 進 L0

### Track B — Dream：create／ref 契約

- **做：** prompt＋context 注入＋mock；create 漏建 → soft warn；phases 鎖 create→node 主檔
- **不要做：** 漏建硬失敗
- **驗收：** mock dream 後 draft／approve 見 create 的 `{id}.md`

### Track C — Web Activities composer

- **做：** `@` popover、ref／create pill、序列化 token、移除 refs 欄、與附件並存
- **不要做：** Clarify／Seek 改造
- **驗收：** 手測／窄測：選 ken→raw 含 `node:ken`；新建 tommy→`node-create:tommy`；撞 id 不可 create

### Track D — 文件收尾

- **做：** api-docs、domain-language、AGENTS、activities-integration skill、changelog／version；刪 backlog 本條；INDEX → shipped
- **不要做：** 假裝有新 browse HTTP

---

## 驗收 checklist

- [x] `@` 可選既有 node → submit 後 L0 `raw` 含 `[@…](node:{id})`；**無** `node_refs` 鍵
- [x] 確認新建 → `[@…](node-create:{id})`；dream／approve 後存在 `nodes/{id}/{id}.md`（mock／phases）
- [x] create 撞 live id → UI 擋；API raw 含該 create → 400
- [x] `POST /activities` 帶 `node_refs` → 400
- [x] 舊 JSONL 殘留 `node_refs` 仍可讀（忽略鍵）；**無** migrate
- [x] 純文字、無 `@` 的捕捉行為與今日相容（除廢欄位外）
- [x] Clarify／Seek 輸入未改成此 composer
- [x] 無 store migrate；boot gate 仍 ≥0.28

---

## 錨點檔案（改前必讀）

| 路徑 | 用途 |
|------|------|
| `web/src/scenes/ActivitiesScene.tsx` | textarea＋`node_refs` 欄＋attachments |
| `web/src/lib/api.ts` | activities body 型別 |
| `server/src/api/activities.ts` | capture 校驗 |
| `server/src/store/memories/capture.ts`／`activities.ts`／`short-term-memory.ts` | L0／pool 寫入與 refs 衍生 |
| `server/src/dream/execute/context.ts` | event→dream context 的 `node_refs` |
| `server/prompts/dream-files.md`／`extract.md` | 入夢寫 node 規則 |
| `server/src/agent/dream/mock.ts` | phases fixture |
| `server/src/cli/self-test.ts` | Phase 9 node_refs 段 |
| `.agents/skills/engram-activities-integration/` | 整合文件 |

---

## 與 0.20／0.31 對照

| | 0.20 | 0.31 | **0.32** |
|--|------|------|----------|
| `node_refs` | ✅ 可選陣列 | — | **廢除（400）** |
| Activity 消歧 | 側車 id | — | **`@` pill＋raw token** |
| Create intent | ❌ | — | **`node-create:`** |
| Chain／UI P1 | — | ✅ | 維持；activity 用 link token |

---

## 開工前仍須拍板

（無。上述建議包已定案；若 design-review 發現洞，併回本表後再實作。）

---

← [0.31.0](../0.31.0/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
