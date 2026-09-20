# 0.3.0 — 搜尋、釐清、附圖、節點圖、工作台殼

← [changelog](../../../changelog.md) · 上游：[0.2.0](../0.2.0/INDEX.md)（`shipped`）· current: [version.md](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md) · HOW：[docs/how.md](./docs/how.md) · WHY：[docs/reasoning.md](./docs/reasoning.md)

> **狀態：** **planned**（2026-09-20）  
> 對齊 Engram 工作台**用得到的面**，但主幹仍是 skills 寫 live `memories/`；server 只讀檔、機械寫入、202 派 Pi。  
> **開工前仍須拍板：無。** 設計審查走 `.agents/skills/roadmap-version`；閘門未過不要實作。

## 產品句

人在薄 UI 上記事（可附圖）、關鍵字搜、問 AI、回答系統補問、沿鏈與**節點圖**翻記憶。沉澱仍按一下（或 crontab 打同一支 POST）讓 distill skill **直接改 vault**，不生 dream report、不 approve。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | Track、禁區、paste-ready |
| 1 | **本檔 INDEX** | 範圍、定案、驗收 |
| 2 | [docs/how.md](./docs/how.md) | 路徑、HTTP、skill 誰寫什麼 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何不做 tmp／future-sight／打分／React |
| 4 | 上游 [0.2.0](../0.2.0/INDEX.md)；構想 [backlog/image-attachments.md](../backlog/image-attachments.md)（不得蓋過本 INDEX） |

## 與上一版對照

| 行為 | 0.2.0 | 0.3.0 |
|------|--------|--------|
| 搜尋 | 無（只有 Ask） | 機械 `GET /search`，不經 Pi |
| 釐清 | 無 | distill 可寫提問檔；人答後下次 distill 吸收進 live 記憶 |
| 附圖 | 僅空目錄 | 上傳落地＋embed＋day 可帶圖；UI 預覽 |
| 節點圖 | 節點列表 | `GET /nodes/graph`＋前端圖 |
| UI | 頂列 hash | 左欄：事件／尋問／提問郵箱／記憶；仍靜態 `web/`，不引入 React |
| 沉澱 | 手動 POST／pi | 同上；文件給 crontab。無內建 cron daemon |

## 實作期間契約權威

本版落地完成 Track F、同步根目錄 `docs/data-spec.md`／`docs/api.md`／`AGENTS.md` **之前**，實作與測試**只認本版 `INDEX.md`＋`docs/how.md`**（衝突時以 INDEX 已定案為準）。現行 0.2.0 契約檔缺本版端點／目錄時，不得據 0.2 檔否定本版已定案。`version.md` 仍出貨才 bump。

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 主幹 | **Skills 寫 live `memories/`。** Server 允許：(a) 同步讀檔 GET；(b) 機械寫入：`POST /events`、上傳圖 bytes、釐清作答／順帶補充落檔；(c) `POST /distill`／`/ask` **202** 派既有 Pi skill。**禁止**在 server 實作「怎麼寫日記／怎麼打分／要不要開 node」。 |
| 2 | 搜尋 | `GET /search?q=`，`q` trim 後不可空否則 400。掃 `memories/chain/**/*.md`、`memories/nodes/**/*.md`、`memories/pool/pending.jsonl`（正文／`raw`／`note`）。**不**掃 `archived.jsonl`、`jobs/`、`_attachments` bytes。大小寫不敏感子字串。回 200 `{ hits: [{ path, snippet }] }`，`path` 相對 vault（如 `chain/days/2026-09/2026-09-16.md`）。最多 50 筆。空 hits 仍 200。**不**經 Pi。 |
| 3 | Ask | 既有 `POST /ask`。UI 尋問頁分「搜尋／提問」。`GET /jobs` 已有：尋問頁列出近 20 筆 `kind===ask` 且終態的摘要（題目用 `input.q`、狀態、時間），點選展示 `output.text`，**不**重跑。 |
| 4 | 釐清目錄 | `{store}/memories/clarify/asking/`、`pending/`、`history/`。檔名 `{id}.md`。`id`＝`cla_`＋當地 `YYYYMMDD`＋`_`＋6 位小寫字母數字。正文 Markdown；YAML frontmatter 至少 `id`、`ts`（RFC3339）。asking＝待人答；pending＝已答、等下次 distill；history＝已吸收。 |
| 5 | 誰寫釐清／何時生題 | **禁止** server／ingest／`POST /events` 生題。`POST /distill` **program 編排兩次獨立 Pi session**（對齊 Engram `runClarifyGenerate`）：(1) Session A `engram-lite-distill`：吸收 `clarify/pending/`、寫 chain／nodes、archive pool；**不寫 asking**；(2) Session B `engram-lite-clarify-generate`：在 `clarify/asking/` **強制新建 MIN 3、MAX 5**。開始前 work（pending.jsonl 非空行＋clarify/pending/*.md）為 0 → **跳過** generate。Session B 後 asking＜3 → program **再跑一次** generate；仍＜3 → job **failed**（禁止 silent 0 題完成）。Skill 只負責判斷問題內容；調度寫死在 `server/pi.ts`。 |
| 6 | 人怎麼答 | 機械：`POST /clarify/asking/{id}/submit` body `{ "answer": "…" }` → 把答案寫進該檔、**移到** `pending/`。`DELETE /clarify/asking/{id}` 丟到 history 並標 dismissed，不再問。`POST /clarify/aside` body `{ "raw": "…" }` 直接在 `pending/` **新建**一筆順帶補充（**不是** pool 事件）：`id`／檔名規則與 #4 相同；frontmatter 必含 `id`、`ts`，且 **`kind: aside`**；正文為 `raw`（可無 `## Answer`）。缺檔 submit／delete → 200＋`present: false` 或等價空成功（冪等），不要 404 當「沒這題」。非法 id → 400。 |
| 6b | 釐清列表讀取 | `GET /clarify/asking`、`GET /clarify/pending` → `{ items: [{ id, ts, markdown }] }`，新→舊。無題 **200**＋空陣列。UI 提問郵箱只靠這兩支；**不**經 Pi。 |
| 7 | Distill 消化釐清 | 每次 distill：**先**讀 `clarify/pending/` 寫進相關 chain／nodes（與 pending.jsonl 同一場），再把那些檔移到 `history/`。然後照舊處理 `pool/pending.jsonl`。Ask skill **不**讀 clarify。 |
| 8 | 附圖上傳 | `POST /attachments` multipart 欄位 `file`。MIME 僅 `image/jpeg`｜`image/png`｜`image/webp`｜`image/gif`。上限 10 MiB。寫入 **正式** `memories/_attachments/uploads/{當地日}/{filename}`（**無 tmp**）。檔名消毒：單一段、禁 `..`／`/`。衝突則 `{stem}-{HHmmss}-{rand6}.ext`。201 `{ path, day, filename }`，`path`＝`_attachments/uploads/{day}/{filename}`。 |
| 9 | 附圖讀取 | `GET /attachments/file?path=` 僅允許上款 path 形；正式檔 200＋對應 Content-Type；缺檔 404。 |
| 10 | 事件帶圖 | `POST /events` 仍要非空 `raw`。`raw` 可含精確 `![[_attachments/uploads/{day}/{file}]]`（禁 `|alias`）。可選 `attachments: [{ path, relationship }]`。**對稱規則：** 若 `raw` 含任一合法 embed，或 `attachments` 為非空陣列，則 embed path 集合與 `attachments[].path` 集合**必須相等**（順序不論）；任一邊缺漏、重複 path 先做集合正規化後再比、缺檔、`|alias`、非法 path → **400**。無 embed 且無 `attachments` 鍵（或省略／空陣列）→ 與 0.2 相同。`relationship` trim 後非空。Server **不**組 Engram 式 appendix；關係只存在 `attachments[]`（寫進該行 JSON）。 |
| 11 | Distill 帶圖 | 讀事件 `attachments[].relationship`（無則當「本則附圖」）。**不要**當自己看得見像素。Day 相關則在敘事裡插入**同一**精確 embed；週／月／年可省略。禁止發明 path。 |
| 12 | 節點圖 | `GET /nodes/graph` → `{ nodes: [{ id, title }], edges: [{ from, to }] }`。點＝現有 node id。邊＝掃描各 `nodes/{id}/{id}.md` 內 `[[nodes/{other}/{other}` 或 `[[nodes/{other}/{other}\|`；`from`＝本文檔 id、`to`＝連結 id；只保留兩邊都存在的點；無向去重（A–B 只一條，字典序小的當 `from`）。空庫 200 空陣列。**不**經 Pi、**不**用 score。 |
| 13 | UI 殼 | 仍 `web/` 靜態 HTML／JS／CSS，**不**引入 Vite／React、**不**複製 Engram `web/src`。版面：左欄四項 **事件／尋問／提問郵箱／記憶**（hash `#/events` `#/seek` `#/clarify` `#/memory`）。記憶內切鏈／節點列表／圖。事件區：textarea＋選檔／貼圖上傳後插入 embed。Chain／pending 預覽把精確 `![[_attachments/uploads/…]]` 渲成 `<img src="/attachments/file?path=…">`。圖用簡單力導向或 SVG（可一小依賴，禁止整份搬 Engram MemoryScene）。 |
| 14 | 定時沉澱 | **不**在 process 內建 cron。README／AGENTS 寫：系統 crontab 對 `POST /distill` 即可（與按鈕同一 worker）。 |
| 15 | 空讀 | 列表／搜尋／釐清／圖等「無資料」→ **200**＋該端點既定 JSON envelope，其集合欄為空陣列（如 `{ hits: [] }`、`{ items: [] }`、`{ nodes: [], edges: [] }`），不要用口語「裸空陣列」取代 envelope。404 只給未知路由，或附件 path 消毒後檔不存在。釐清缺題 submit／delete 仍依 #6：200＋`present: false`（不是 404）。 |
| 16 | 本版不改 | Pi 模型解析、同時一場 job、升層閘門、chain 單檔敘事、event `id` 規則、vault＝`memories/`、jobs 不進 vault。 |

## 開工前仍須拍板

無。

## 非目標

- Dream report、pending_review、approve／discard／amend、近期入夢報告 UI
- Setup wizard
- Future-sight（`upcoming.md`／`longTerm.md`）
- Node `score.yaml`／打分 UI
- Capture `@` mention token
- 虛擬時鐘、store git、day ledger／`.summary.md`、L0＋STM 雙 jsonl
- 與 `engram-data` 共用庫；vision／OCR／HEIC
- 上傳 tmp 目錄、Engram appendix 標題區塊
- 內建排程 daemon、Claude／Cursor／Codex agent 後端
- Node 合併、向量搜尋
- 把 UI 重寫成 Engram 的 Vite＋React 工作台

## 驗收

- [ ] `GET /search?q=` 能命中 fixture 日檔或 pending 子字串；空 q → 400；無命中 → 200 `{ hits: [] }`
- [ ] 尋問頁可搜、可 ask、可看到最近 ask job 而不重跑
- [ ] 有 pending 可沉澱的 distill job：Session A 寫 chain／nodes 後，Session B 在 `clarify/asking/` **新建 3–5** 題；空庫早退則 asking 可不增；＜3 時 retry 一次，仍不足則 job failed。submit 後檔在 `clarify/pending/`；再 distill 後該檔在 `history/`，且滿足**客觀吸收判準（擇一寫進測試即可）**：(1) fixture 約定關鍵字出現在對應 day 或相關 node 正文；或 (2) 該檔 frontmatter 含 `absorbed_at`（RFC3339）且已在 `history/`。fixture 題目／答案用虛構字串，勿用真人記憶正文
- [ ] aside 不進 `pool/pending.jsonl`
- [ ] 上傳 png 201 且磁碟在 `_attachments/uploads/{day}/`；`POST /events`：僅 embed、僅 `attachments[]`、或缺邊對稱 → 400；兩邊 path 集合相同 → 200；無圖 → 與 0.2 相同；缺檔或 alias embed → 400
- [ ] Day 稿可含同一 `![[…]]`；mock／測不必真 Pi 看圖
- [ ] `GET /nodes/graph` 兩邊都存在的 wikilink 成邊；死連忽略
- [ ] 左欄四景可切；圖頁能畫出 ≥2 點的邊；事件頁圖片預覽走 file GET
- [ ] 無 React／Vite 新工具鏈；無 `dreams/` 目錄
- [ ] `bun test` 全綠；測試不碰真人 `ENGRAM_LITE_STORE_DIR`

## 實作軌道

| Track | 做 | 不要 |
|-------|----|------|
| A 搜尋＋Ask 列表 | `GET /search`；尋問 UI；jobs 列表 | Pi 做 keyword；掃 archived |
| B 釐清 | 目錄＋機械 POST／DELETE；distill（不生題）＋獨立 session `clarify-generate`（MIN3–MAX5）；郵箱 UI；`POST /distill` program 兩 session |
| C 附圖 | 上傳 GET、events 校驗、distill 教學、預覽 | tmp、vision、appendix |
| D 節點圖 | graph GET＋圖 UI | score、Engram graph 元件整包 |
| E 殼 | 左欄四景、CSS 對齊紙色／左欄，仍靜態 web | 重寫 React |
| F 契約 | data-spec、api.md、AGENTS、README crontab 一句 | bump `version.md`（出貨才改） |

## 錨點

`server/index.ts`、`server/store.ts`、`server/paths.ts`、`web/app.js`、`web/style.css`、`.agents/skills/engram-lite-distill/SKILL.md`、`.agents/skills/engram-lite-ask/SKILL.md`、`docs/data-spec.md`、`docs/api.md`。

← [0.2.0](../0.2.0/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
