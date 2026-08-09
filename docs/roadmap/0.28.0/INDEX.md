# 0.28.0 — Node 主檔重構（Obsidian 對齊）＋結構生長約束

← [changelog](../../../changelog.md) · 上游：[0.27.0](../0.27.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)  
來源研究（摘要已吸入本版 docs；實作以本版為準）：[`research-notes/obsidian/engram-obsidian-decisions-2026-08-09.md`](../../../../research-notes/obsidian/engram-obsidian-decisions-2026-08-09.md)（若 workspace 未掛 research-notes，見本版 [docs/reasoning.md](./docs/reasoning.md)）

> **狀態：** **shipped**（2026-08-09）  
> 將 L2 node 認知主檔從 `understand/what.md` 遷到 **`nodes/{id}/{id}.md`**，廢 stub `INDEX.md`／空 `understand/`；契約上對齊 **Obsidian vault＝`memories/`**。同步強化 dream／seed／report **`## Structure notes` 軟校驗**，讓 AI **自然寫進正確結構**（含 Relation 的 node 互指 wikilink）。**有** store migrate＋boot 最低代上調；migrate **離線**、不依賴 server API。

## 產品句

> 人以 Obsidian 開啟 `memories/` 時，每個 node 是一份與 id 同名的主筆記；Memory／Seek／dream 讀寫同一檔。入夢時 AI 依固定骨架與互指規則**長出**可維護的理解網，而不是日記式 `what.md` 或無法點開的純文字人名。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 給實作 agent 的開工交接（讀序／禁區／貼上用 prompt） |
| 1 | **本檔 INDEX** | 範圍、定案、軌道、驗收 |
| 2 | [docs/node-layout.md](./docs/node-layout.md) | 新舊路徑、vault root、關聯目標、migrate 機械步驟 |
| 3 | [docs/structure-growth.md](./docs/structure-growth.md) | 如何「圍護」AI：prompt／seed／白名單／軟校驗分層 |
| 4 | [docs/reasoning.md](./docs/reasoning.md) | 為何 `{id}.md`、為何 vault＝memories、否決過的方案 |
| 5 | [docs/migrate-0.19-to-0.28.md](./docs/migrate-0.19-to-0.28.md) | 結構 hop 契約（skill 執行檔出貨時同步到 `.claude/skills/engram-migration/`） |
| 6 | [docs/implementation-review.md](./docs/implementation-review.md) | 實作審查（HIGH／MEDIUM／修復追蹤） |

---

## 問題（本版要修什麼）

1. **路徑與 Obsidian 撞名：** 每個 node 的主檔都叫 `what.md`，短 wikilink 不可用；stub `INDEX.md` 與真正認知正文分裂。
2. **關聯無邊：** `## Relation` 常寫純文字人名，Obsidian graph／backlinks／未來 Engram 抽邊都看不到。
3. **結構易漂：** 0.25 已定四段骨架，但僅靠 prompt；本版路徑重構是一次「把正確形狀變成預設落點」的機會，並以 Structure notes 軟校驗圍護生長。

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | Node 主檔路徑 | **`memories/nodes/{id}/{id}.md`**＝standing understanding（四段骨架語意不變，見 0.25／0.26） |
| 2 | 廢止 | `memories/nodes/{id}/understand/what.md`；空目錄 `understand/`；stub **`INDEX.md`**（`See understand/what.md` 那類） |
| 3 | 保留 | `node.meta.yaml`；`score.yaml`（若存在）；**不**改 score 演算法 |
| 4 | API | 對外仍回 **`understanding`**（整檔正文）。**不**改 JSON 鍵名；只改磁碟路徑與文件中的 path 字串 |
| 5 | Obsidian vault | **人應開啟 `{ENGRAM_STORE_DIR}/memories/`**，**不要**開 store 根（`dreams/` 為暫存審稿區，不進 vault） |
| 6 | md 內連結前綴 | 相對 **vault＝`memories/`**：互指例 `[[nodes/mak/mak\|Mak]]` 或短 `[[mak]]`；**不**寫 `memories/nodes/…` 前綴 |
| 7 | 關聯目標 | Node→node **只**指向對方主檔 `nodes/{id}/{id}.md`（不是 meta／score） |
| 8 | 短連 | Obsidian 人手可打 `[[id]]`（basename 唯一時可解析）；**Engram 機器寫入**只產出 P1／#19 的 path 形態 |
| 9 | Store 世代 | **Bump `store_version` → `0.28.0`**；boot 最低結構代上調為 **`0.28`**（與 0.19 gate 同機制）；escape hatch `ENGRAM_ALLOW_STALE_STORE=1` 仍可用 |
| 10 | Migrate | 機械 hop：**搬** `understand/what.md` → `{id}.md`；**刪** stub `INDEX.md` 與空 `understand/`；stamp `0.28.0`。正文內容不重寫（不自動把散文變成 wikilink） |
| 11 | 准入 hop | 磁碟仍為 `understand/what.md` 佈局、且 `store_version` major.minor ∈ **0.19–0.27**（含同結構代較新字串）→ 走本 hop；見 migrate doc |
| 12 | Dream 白名單 | 可寫 node 敘事路徑改為 draft 下 `memories/nodes/{id}/{id}.md`；**拒絕**再寫 `understand/what.md` |
| 13 | 新建 seed | 建立 node 時主檔一開始即四段骨架＋檔名 `{id}.md`；**不**再建立 stub `INDEX.md` |
| 14 | Standing 骨架 | 維持 0.25：`## Identity` → `## Relation` → `## Standing facts` → `## Current situation`；空段 `_None_`；整檔 rewrite；事件細節仍在 chain |
| 15 | Relation 互指（產品） | 提及**已知／本輪建立的**其他 L2 node 時，Relation（或必要時 Standing facts）須含 **可解析 wikilink** 指向其主檔；禁止「只有口語名字、從頭到尾零連結」作為完成態 |
| 16 | `_attachments` | **本版不做**（尚無 image／activity 附圖支援）。路徑約定仍留 backlog／research；等附圖版再 ensure／migrate 建立目錄 |
| 17 | UI | Memory／Seek：**不**為本版重做 IA；仍渲染 `understanding`。文件／setup／AGENTS 註明 vault＝`memories/` |
| 18 | 產品版號 | 出貨時 `version.md`／changelog → `0.28.0`；新建庫 stamp `store_version: 0.28.0` |
| 19 | 機器寫入 wikilink（P1） | **一律** `[[nodes/{id}/{id}\|顯示名]]`（vault＝`memories/` 相對 path＋`|` 顯示名）。例：`[[nodes/mak/mak\|Mak]]`。Prompt／mock／文件以此為唯一規範；**不**以裸 `[[mak]]` 作為 Engram 寫入標準（人在 Obsidian 手打短連仍可解析，但不由 agent 產出） |
| 20 | 結構軟校驗（P2） | Dream **finalize** 後，機械掃 draft node 主檔；結果寫入 pending report 一節 **`## Structure notes`**（無問題時寫 **`_None_`**，節本身保留）。**只警告，不**把 job 打成 failed、**不**阻止進入／停留 `pending_review`。缺 link 偵測：對已知 node id 做簡單詞界／子字串檢查即可 |
| 21 | Approve 缺四段小標（P3） | **不硬拒**（維持 0.25）：缺標題仍可 `POST /dreams/approve` 成功 deploy；依賴 P2 警告＋後續 dream／amend |
| 22 | 死連（P4） | **只警告**（可進 Structure notes）：連結目標在 live＋本輪 draft 新建中皆不存在時不擋 approve。本輪 draft 將建立的 `{id}.md` 視為存在 |
| 23 | Migrate 與 pending／server（P5） | **Migrate 全程離線**（不經 HTTP、不需先 start server）。若存在 pending／`dreams/draft/*`：**script 直接清空 pending**（等價 discard：移除 draft 目錄、將對應 dream run 標為 discarded 或刪除 pending 標記、清 lock／in-flight job 若有；**不**改寫 draft 內 path）。Hop 開始前仍須備份；stdout／skill 須明示「未批准的夢已丟棄」。Boot 拒啟文案寫明跑 migration skill、**無需先啟動 server**。`ENGRAM_ALLOW_STALE_STORE=1` 僅逃生 |
| 24 | `\|顯示名` | 機器寫入時顯示名預設用 **node id**（例 `[[nodes/mak/mak\|mak]]`）；本版不強制從 Identity／meta 推人類可讀名 |
| 25 | Committed report TTL 預設 | **`dream_committed_report_retention_days` 程式預設 30 → 7**（workspace／env 仍可覆寫；`-1`＝永久）。早前已定、未 commit；**併入本版**出貨。文件／`GET /status` 範例對齊 7 |

---

## 開工前仍須拍板

（無。P1–P5 已全部收進已定案。）
---

## 非目標

- Activity 附圖上傳／multipart API／拖放 UI；**亦不**在本版建立 `memories/_attachments/`（backlog `activity-images`；路徑約定已有 research）
- Engram 內 network graph GUI；typed `graph/links.yaml` 雙寫
- Node merge；Seek 依活躍分；vector search；反思補問
- 恢復多 facet 檔（who／open…）
- 改 chain／future-sight 路徑
- 全庫把舊散文人名自動改成 wikilink（懶／後續 dream 觸及時再寫入）
- 要求使用者安裝 Obsidian 外掛

---

## 實作軌道

### Track A — Store 路徑＋讀寫核心

- **做：** `server/src/store/memories/nodes.ts` 等改讀寫 `{id}.md`；建立 node 不再寫 stub INDEX／understand；搜尋／browse／dream context 跟新路徑；write-policy 白名單更新
- **不要：** 改 score 公式；改 `understanding` JSON 鍵
- **驗收：** 新庫無 `understand/what.md`；API detail／search 仍回 `understanding`

### Track B — Dream／amend prompt＋mock

- **做：** `dream-files.md`／`amend-dream.md`：路徑、vault 相對 wikilink 規則、Relation 須互指；mock 建／改 `{id}.md` 含四段＋至少示例 link 形狀；forbidden 舊 path
- **不要：** 重跑 rollup 語意；改 amend API 形狀
- **驗收：** mock dream approve 後磁碟為 `nodes/{id}/{id}.md`；self-test 斷言路徑與骨架

### Track C — 結構生長圍護（軟校驗）

- **做：** finalize 後掃 draft node 主檔；寫入 report `## Structure notes`（P2）；缺小標／疑似無 link／死連皆警告；approve **不**因 P3／P4 失敗
- **不要：** 因結構警告 failed job；approve 硬拒缺標題或死連
- **驗收：** fixture 缺標題 → report 有 Structure notes；approve 仍 200 系契約成功

### Track D — Migrate＋boot gate＋skill

- **做：** `migrate-0.19-to-0.28` script＋skill md；live 機械 rename；**有 pending 則離線清空**（等價 discard，不改寫 draft）；boot 最低代 `0.28`；拒啟文案含「離線跑 skill、無需先 start server」；更新 engram-migration `SKILL.md` 表
- **不要：** 以「請先 API discard」作為 hop 前置；嘗試轉換舊 draft 路徑；手改 live 冒充 migrate；合併多代 shortcut
- **驗收：** 舊庫未開 server 可完成 hop；有 `dreams/draft` 時 hop 後無 pending／draft 已清；未 migrate 拒啟（無 escape）

### Track E — 文件與出貨

- **做：** api-docs、AGENTS、domain-language、configurations、workbench skill、setup／README 註 vault；version／changelog；backlog activity-images 目錄名對齊 `_attachments`；research decisions 加「已排入 0.28」
- **驗收：** 契約 path 字串無殘留 `understand/what.md` 作為現行真相（史料／changelog 可保留）

---

## 驗收（出貨 checklist）

- [x] 新／migrate 後 node 主檔為 `memories/nodes/{id}/{id}.md`；無必填之 `understand/what.md`／stub `INDEX.md`
- [x] `GET` node／search／dream context：`understanding`＝該主檔整檔
- [x] Dream／amend **不能**把新寫入落到舊 `understand/what.md`（白名單／測試）
- [x] Prompt／mock 含四段骨架＋ Relation wikilink 規則（P1 形態）
- [x] Finalize report 含結構軟警告路徑（P2）；approve 不因缺小標／死連失敗（P3／P4）
- [x] `store_version` 最低 boot **0.28**；hop 文件與 script 在 skill 目錄；**離線可跑**；有 pending 時 hop **清空** draft／pending（P5）
- [x] 文件寫明 Obsidian 開 `memories/`（**不**要求本版建立 `_attachments/`）
- [x] Boot 拒啟提示含 migration skill 路徑且說明無需先啟動 server
- [x] `bun run test:phases` 通過
- [x] version／changelog／AGENTS 已更新；狀態 → `shipped`

---

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/store/memories/nodes.ts` | 主檔 path／readUnderstanding／create node |
| `server/src/agent/shared/write-policy.ts`（及 test） | draft 可寫路徑 |
| `server/prompts/dream-files.md` | 入夢寫入規則 |
| `server/prompts/amend-dream.md` | 同稿小修規則 |
| `server/src/agent/dream/mock.ts` | mock 落盤形狀 |
| `server/src/config.ts`／boot gate | 最低 `store_version` |
| `.claude/skills/engram-migration/` | hop 執行真相 |
| `docs/api-docs/api.md` | 契約 path 字串 |
| `docs/roadmap/0.25.0/` | standing understanding 語意（不重訂，只換 path） |

---

## 與上一版對照

| | 0.27.0 | 0.28.0 |
|--|--------|--------|
| 主線 | amend-dream | **node 主檔重構＋結構生長圍護** |
| Node 路徑 | `understand/what.md` | **`{id}/{id}.md`** |
| Store migrate | 無 | **有（→ 0.28）** |
| Obsidian | 未契約 vault root | **vault＝`memories/`** |
| Relation 互指 | 未要求 wikilink | **要求可解析連結（形態見 P1）** |
| Committed report TTL 預設 | **30** 日 | **7** 日（#25） |
