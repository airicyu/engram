# 0.35.0 — 附件圖＋短期記憶只留 pool records

← [changelog](../../../changelog.md) · 上游：[0.34.0](../0.34.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**  
> **本版兩項：**（1）Workbench `MdBlock` 把精確附件 embed 渲成 `<img>`。（2）短期記憶磁碟**只**留 `pool.jsonl`；HTTP 以 `entries[]` 回傳，廢 `summary.md`／`nodes/` notes 與 API `summary`／`node_notes`。**無** store migrate；**不**抬 boot gate。

## 產品句

> 人在 Memory 等 `MdBlock` 表面看到附圖；尚未入夢的活動以一則則 `{ id, ts, raw }` 存在 pool，不再壓成 markdown 複本。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 兩軌範圍、定案、驗收 |
| 2 | [docs/reasoning-stm.md](./docs/reasoning-stm.md) | 為何廢 STM summary／node notes |

---

## Track A — MdBlock 附件圖

### 問題

0.29 把圖以 `![[_attachments/uploads/…]]` 寫進 vault／chain；0.31 刻意不把此 embed 渲成 `<img>`。

### 已定案

| # | 題 | 決定 |
|---|-----|------|
| A1 | 範圍 | **僅** `web/`：preprocess＋`MdBlock`＋圖片 CSS。**不**改附件 HTTP／capture |
| A2 | 認哪種 embed | **只**精確形 `![[_attachments/uploads/{YYYY-MM-DD}/{filename}]]` |
| A3 | 不轉換 | `![[path\|alias]]`；含 `/tmp/`；非 `_attachments/uploads/`；非法 path → **原樣保留** |
| A4 | 圖片 URL | `/api/attachments/file?path=`＋`encodeURIComponent(path)` |
| A5 | 套用 | 所有 `MdBlock` 同一 preprocess |
| A6 | 與 node wikilink | 先 `preprocessNodeWikilinks`，再轉附件 embed |
| A7 | 缺檔 | `<img>` 仍輸出；不另做自訂錯誤 UI |

### 非目標（A）

- 新附件 API、WYSIWYG、非附件 `![[…]]`

---

## Track B — 短期記憶只留 pool.jsonl

### 問題

`summary.md` 與 `nodes/{id}/notes.md` 都是 `pool.jsonl` 的複本。markdown 把 record 壓扁，之後無法當一則則 post 顯示。

### 已定案

| # | 題 | 決定 |
|---|-----|------|
| B1 | 磁碟 | **唯一**檔＝`memories/short-term-memory/pool.jsonl`。停止寫 `summary.md`、`today-summary.md`、`nodes/` |
| B2 | 殘檔 | ensure／每次 pool 寫入：刪上述衍生檔與 `nodes/` 目錄。舊庫 pool 空但有 summary → **先遷進 pool 再刪**。無 store_version hop |
| B3 | Capture | 仍 append L0 + pool；mention 仍在 `raw` |
| B4 | `GET /memories/short-term-memory` | `{ entries: [{ id, ts, raw }], present }`。**省略** `summary`、`node_notes` |
| B5 | Activities UI | 依 `entries` **逐則**顯示；不拼成單一 markdown |
| B6 | Search | `l1` 命中 `{ entries }`（比對 `raw`／`id`）。廢 `match_reason: l1_note`（只留 `node_id`｜`what_content`） |
| B7 | Dream | 刪 `l1.node_notes`。`l1.summary` 可 **記憶體內** formatLine，不寫磁碟。Ask prompt 只列 `pool.jsonl` |
| B8 | Migrate | **無**；boot gate 仍 ≥0.28 |

### 非目標（B）

- 完整 Twitter／post UI、改 pool schema、廢 mention、抬 boot gate

---

## 錨點

| 路徑 | 用途 |
|------|------|
| `web/src/components/ui.tsx` | `MdBlock` |
| `web/src/lib/preprocessNodeWikilinks.ts` | 已跳過 `![[…]]` |
| `GET /attachments/file` | 附件 bytes |
| `server/src/store/memories/short-term-memory.ts` | pool 與衍生檔清理 |
| `server/src/api/memory/short-term-memory.ts` | GET packet |
| `server/src/seek/search.ts` | Search `l1`／`l1_note` |
| `server/src/dream/execute/context.ts` | Dream `l1` |
| `web/src/scenes/ActivitiesScene.tsx` | 逐則 feed |

---

## 驗收

- [x] Memory chain 精確附件 embed 顯示為圖片；alias／非法 path 仍為字面；node P1 仍可點
- [x] 新 activity 後短期目錄只有 `pool.jsonl`
- [x] `GET /memories/short-term-memory` 為 `entries`＋`present`，無 `summary`／`node_notes`
- [x] Activities 逐則顯示；Search `l1` 為 entries；L2 無 `l1_note`
- [x] Ask prompt 只指向 `pool.jsonl`；Dream 不注入 `node_notes`
- [x] `version.md`／`changelog.md`／契約／AGENTS＝0.35.0；**無** migrate

---

## 與相鄰版本

| | 0.34.0 | **0.35.0** |
|--|--------|------------|
| 焦點 | 廢 Ask `include_later` | **附件圖 ＋ STM 只留 pool records** |
| STM 磁碟 | pool＋summary＋node notes | **僅 pool.jsonl** |
| GET STM | `summary`＋`node_notes` | **`entries[]`** |
| migrate | 無 | **無** |
