# 0.29.0 — Activity 附圖（media attachments）

← [changelog](../../../changelog.md) · 上游：[0.28.0](../0.28.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md) · 來源：backlog activity-images（已出貨刪除）

> **狀態：** **shipped**  
> **本版只做這一項：** Activities 捕捉附圖（tmp 上傳、media attachments UI、submit 搬檔＋標題區塊 appendix、對稱校驗、tmp housekeep、dream／STM prompt 教讀寫 embed）。**不做**其他 backlog（graph、vector、反思補問等）。

## 產品句

> 人在 Activities 用拖放／貼上把圖附在一則不可空的 markdown 敘事上，並為每張圖填短 relationship；寫入後檔在 vault `_attachments/uploads/`，event 含結構化 attachments＋server 組好的 appendix。入夢時 AI 靠文字關係選材，用同一 `![[…]]` 寫進 chain（上層可取捨）；**不**要求 vision。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 給實作 agent 的開工交接（讀序／禁區／貼上用 prompt） |
| 1 | **本檔 INDEX** | 範圍、定案、軌道、驗收 |
| 2 | [docs/capture-and-appendix.md](./docs/capture-and-appendix.md) | 路徑、API 形狀、校驗、appendix 渲染規則 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何 tmp／標題區塊／不依賴 vision／不做 WYSIWYG |
| 4 | [docs/design-review.md](./docs/design-review.md) | 設計審查史料；**D／F 已併入本檔已定案**（2026-08-10） |
| 5 | [docs/implementation-review.md](./docs/implementation-review.md) | 實作審查（HIGH／MEDIUM／驗收對照；初審 2026-08-10） |

---

## 已定案

### 目錄與引用

| # | 題 | 決定 |
|---|-----|------|
| 1 | Vault | 維持 0.28：Obsidian vault＝`memories/` |
| 2 | 正式檔 | `{store}/memories/_attachments/uploads/{YYYY-MM-DD}/{filename}` |
| 3 | 暫存檔 | `{store}/memories/_attachments/uploads/tmp/{YYYY-MM-DD}/{filename}` |
| 4 | Embed | 只用 `![[_attachments/uploads/{日}/{名}]]`（相對 vault；**永不**含 `/tmp`） |
| 5 | 日界 | **有效 timezone** 日曆日（與 chain／activity ts 同一套） |
| 6 | 建目錄 | 首次上傳／submit／ensure 時建立；舊庫無目錄不算壞 |
| 7 | Path 消毒 | `day` 須匹配 `YYYY-MM-DD`；`filename` 為單一段（禁 `..`、`/`、`\`、空名）；`attachments[].path` 必須**精確**等於 `_attachments/uploads/{day}/{filename}`，否則 **400** |

### Capture UX

| # | 題 | 決定 |
|---|-----|------|
| 8 | 版面 | 上方 markdown **textarea**；下方 **media attachments**（產品用語固定此名） |
| 9 | 拖放 | 上傳 tmp → 列表＋一項 → 於 **游標處**插入 embed，前後各一空行 |
| 10 | 剪貼簿貼圖 | 同拖放；無檔名 → **uuid v4**（副檔名由 MIME 推，如 `.png`） |
| 11 | Relationship | 每項 **必填**；multiline、可 resize、初始約 1 行；預期短述 |
| 12 | raw | trim 後 **不可空**（不可「只有圖」） |
| 13 | 刪附件（compose） | 刪 **tmp** 實體＋從 textarea 去掉對應 `![[…]]` |
| 14 | 選檔輔助 | 低調 **paperclip／＋**；**主路徑**仍是拖放／貼上 |

### Submit／校驗／檔名

| # | 題 | 決定 |
|---|-----|------|
| 15 | Submit 順序 | 在既有 **capture lock** 內：(1) 校驗 (2) tmp→正式 move (3) 組 appendix (4) 寫 L0＋STM |
| 16 | Submit 失敗回滾 | 若已 move 但寫 L0／STM 失敗：回應 **非 2xx**；**best-effort** 將已 move 檔搬回 tmp，避免「有正式檔無 event」。若搬回亦失敗：仍非 2xx＋可觀測 log；**不**另做補償 API |
| 17 | Appendix | **僅 server** 依 `attachments[]` 渲染；client 交 **正文（可含行內 embed）**＋結構化 attachments |
| 18 | 對稱校驗 | 正文內嵌圖目標集合 **＝** `attachments[].path` 集合；否則 **400** |
| 19 | 對稱只認精確形 | 只認精確 `![[{path}]]` 且 `{path}`＝`attachments[].path` 字面；`![[path\|alias]]`、多餘空白等 → 視同未引用／非法 → **400** |
| 20 | Relationship 空 | 前端擋＋後端 **400** |
| 21 | attachments 重複 path | 同一 `path` 出現超過一次 → **400**（勿靜默去重） |
| 22 | 檔名無衝突 | 檢查該日 **tmp＋正式**；無衝突用原名 |
| 23 | 檔名衝突 | `{stem}-YYYYMMDD-HHmmss-{rand6}.ext`；時間戳＝**有效 timezone**（＋虛擬鐘，同 `nowIso`／run-id）；`rand6`＝`Math.random().toString(36).slice(2, 8)` |
| 24 | 檔名誰定 | **只在 server 定名**；上傳回應回傳最終 `path`／`day`／`filename` |
| 25 | Event 雙軌 | `attachments?: { path, relationship }[]`（機器真相）＋ `raw`＝正文＋appendix（由 attachments 渲染）。L0 與 STM 所見 `raw` 皆為 **server 最終稿**（含 appendix，若有附件） |

### Appendix schema（標題區塊）

| # | 題 | 決定 |
|---|-----|------|
| 26 | 形狀 | 正文與 appendix 之間單獨一行 `------`；然後 `## Attachment relationships`／`### {n}`／`**name:**`／`**relationship:**`（見 [capture-and-appendix](./docs/capture-and-appendix.md)） |
| 27 | 禁止 | nested code fence 包 relationship |
| 28 | 雙重 appendix | 請求 `raw` 已含 `## Attachment relationships` → **400** |

### AI／傳承

| # | 題 | 決定 |
|---|-----|------|
| 29 | 選材 | 依 **raw＋relationship**；vision **非**前提 |
| 30 | 同一檔 | 各層只重複同一 `![[path]]`，不複製 bytes |
| 31 | Prompt | `dream-files`（及必要 STM／extract 說明）明示讀 appendix、寫 embed、上層可取捨、勿假設 vision |
| 32 | Ledger | **不**做 server 強制往 ledger 挂 embed |

### 上傳限制

| # | 題 | 決定 |
|---|-----|------|
| 33 | MIME | **`image/jpeg`｜`image/png`｜`image/webp`｜`image/gif`**；**拒 HEIC** 與其餘 |
| 34 | 單檔大小 | 可配置；預設 **10 MiB**＝`10485760` bytes。Workspace **`attachment_max_bytes`**／env **`ENGRAM_ATTACHMENT_MAX_BYTES`**。超限 → **400** `file_too_large` |
| 35 | 每則張數 | **不限** |

### API

| # | 題 | 決定 |
|---|-----|------|
| 36 | 上傳 | `POST /attachments/uploads`；multipart 欄位名 **`file`**；成功 **201**；落地 tmp；回應最終 path／day／filename |
| 37 | 刪 tmp | `DELETE /attachments/uploads/tmp?day=&filename=`（**query**）；不可刪正式目錄；缺檔 → **200** 冪等 |
| 38 | 寫入 | 擴充 `POST /activities`：`raw`（無 appendix）＋可選 `attachments[]`；server 組最終 raw |
| 39 | Lock | dream lock 時上傳與 activities → **409** `dream_locked` |
| 40 | 預覽 | `GET /attachments/file?path=`（**query**）；回傳檔案 bytes；先查正式再查 tmp |
| 41 | Housekeep API | `POST /attachments/housekeep`；手動觸發 tmp 清理；回應 `{ removed: string[] }` |

### Store／Git／Housekeep／出貨

| # | 題 | 決定 |
|---|-----|------|
| 42 | `store_version` | **無**新 migrate hop；boot 仍 **≥ 0.28**；新建可 stamp `0.29.0` |
| 43 | Housekeep 策略 | 只清 `uploads/tmp/**`；依 **目錄名 `{YYYY-MM-DD}`** 相對有效時鐘「今天」的日差 ≥ retention 則清理該日 tmp（虛擬鐘友好）。預設 **2** 天；workspace **`attachment_tmp_retention_days`**／env **`ENGRAM_ATTACHMENT_TMP_RETENTION_DAYS`**；startup 自動跑＋cron（`attachment_housekeep_cron` 預設 `30 2 * * *`） |
| 44 | Git ignore | 忽略 `memories/_attachments/uploads/tmp/`；ensure 時 **自動確保** ignore；正式 `uploads/{日}/` **不**被 ignore |
| 45 | Git commit 時機 | **對齊現行**：activities／上傳只寫盤；**dream approve**（既有 store git）才 commit。本版**不**為每則 activity 新增 commit |
| 46 | 產品版號 | 出貨 `version.md`／changelog → `0.29.0`；本版只含附圖相關變更 |
| 47 | 跨日／tmp 過期 | path 日＝**上傳日**；upload 與 submit 可跨日。tmp 被 housekeep 後 submit 缺檔 → **400**；UI 顯示錯誤即可，本版不做自動恢復 |

---

## 開工前仍須拍板

（無。設計審查 D1–D5、F1–F5 與 N1／N3 已於 2026-08-10 併入已定案。）

---

## 非目標

- 其他 backlog（node graph、vector search、反思補問、Seek 活躍分、shared Zod package）
- 完整 Markdown WYSIWYG／區塊編輯器
- 強制／實作 vision 讀圖管線
- Activity **reuse** 既有正式附件（記在 backlog；本版不做）
- 影片、CDN、Obsidian 人手改路徑後回掃
- Week／month／year **機械**強制插入全部附件
- 清已 submit 的 `uploads/{日}/` 正式檔
- Node merge；改 chain／future-sight 路徑結構
- 上調 boot 門檻到 0.29（本版明示不抬）
- Submit 半失敗後的專用補償／管理員修復 API（僅 best-effort 搬回 tmp＋log）

---

## 實作軌道

### Track A — Store＋attachments API＋activities 擴充

- **做：** ensure＋gitignore；上傳（`file`、201、消毒、MIME／max bytes）；刪 tmp（query、冪等）；activities 校驗（精確對稱、重複 path、雙重 appendix）＋move＋失敗搬回＋組 appendix＋L0／STM；housekeep 依目錄日；錯誤碼進 api.md
- **不要：** 刪正式 uploads；reuse；HEIC；每則張數上限；每則 activity git commit
- **驗收：** curl 上傳→activities→events 含 appendix／attachments；對稱／重複／消毒失敗→400；寫入失敗不留「有正式檔無 event」（盡力）；lock→409

### Track B — Web Activities compose

- **做：** textarea＋media attachments；拖放／貼上＋paperclip／＋；游標插入精確 `![[path]]`；relationship 必填；錯誤顯示；刪項同步正文；i18n
- **不要：** WYSIWYG；媒體庫；前端定最終檔名；插入 `![[path\|alias]]` 當機器形
- **驗收：** 一圖＋raw＋relationship → 成功；校驗失敗可見錯誤

### Track C — Prompt＋STM／dream 教學

- **做：** prompt 教 appendix schema、精確 embed、選材可取捨、勿假設 vision
- **不要：** 改 rollup 演算法；強制每層 embed
- **驗收：** mock／phases 帶附件可跑；prompt 可 grep `Attachment relationships`

### Track D — 文件與出貨

- **做：** api-docs、AGENTS、skills 若需、version／changelog、setup／README 附件一句；出貨後清 backlog 列
- **不要：** 順手 graph／vector
- **驗收：** 契約＝INDEX；`bun run test:phases` 通過

---

## 驗收

- [x] 拖放／貼上 → tmp；正文為精確 `![[_attachments/uploads/…]]`（無 `/tmp`）
- [x] media attachments 必填 relationship；空 → 前後端拒絕
- [x] raw 空 → 拒絕；已含 `## Attachment relationships` → 400
- [x] Submit：move＋最終 raw 含標題區塊 appendix；`attachments[]` 一致
- [x] 對稱失敗／`|alias`／重複 path／非法 path → 400＋UI 錯誤
- [x] 寫入失敗：非 2xx；盡力搬回 tmp
- [x] Delete compose：刪 tmp＋去占位；DELETE 缺檔 200
- [x] 上傳 201、欄位 `file`；lock → 409
- [x] Housekeep 只清 tmp、依目錄日；預設 2 天；max bytes 鍵生效（預設 10MiB）
- [x] Ensure 自動 ignore tmp；正式 uploads 可追蹤；**無**每則 activity commit
- [x] Dream prompt 含教學；無 vision 硬依賴
- [x] 無 0.29 migrate hop；boot ≥0.28；`version.md`＝`0.29.0`
- [x] `bun run test:phases` 通過；出貨後 backlog 附圖列移除

---

## 錨點

| 路徑 | 用途 |
|------|------|
| `web/src/scenes/ActivitiesScene.tsx` | Capture UI |
| `server/src/api/activities.ts` | `POST /activities` |
| `server/src/store/memories/activities.ts` | L0 `Event` 形狀 |
| `server/src/store/dreams/cleanup.ts`／`cli/dreams-cleanup.ts` | TTL 模式參考 |
| `server/src/dream/review/approve.ts` | store git commit 時機 |
| `server/prompts/dream-files.md` | 入夢寫檔規則 |
| `docs/api-docs/api.md` | HTTP 契約 |
| `docs/roadmap/0.28.0/INDEX.md` | vault＝memories；`_attachments` 留給本版 |

---

## 與上一版對照

| | 0.28.0 | 0.29.0 |
|--|--------|--------|
| 焦點 | Node 主檔 `{id}.md`＋wikilink／Structure notes | **Activity 附圖** |
| `_attachments/` | 明示不建 | **建立並使用** `uploads/`＋`uploads/tmp/` |
| `POST /activities` | 僅文字 `raw` 等 | ＋ attachments／tmp 搬檔／appendix |
| Store migrate | 0.19→0.28 hop | **無**新 hop |
| 其他 backlog | — | **本版不做** |
