# 0.26.0 — Node API `what_current` → `understanding`

← [changelog](../../../changelog.md) · 上游：[0.25.0](../0.25.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**  
> 對外 JSON／型別欄位 `what_current` **一次改名**為 `understanding`（語意＝`what.md` 整檔 standing understanding，與 0.25 相同）。**無** store migrate；**不**改 `what.md` 路徑。來源構想曾列 backlog（出貨後刪除；真相以本版為準）。

## 產品句

> 整合端與 UI 讀到的 node 正文欄位名與產品詞對齊：`understanding`＝長期 standing understanding 整檔，不再被歷史名 `what_current` 誤導成「僅 Current 段」。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、軌道、驗收 |
| 2 | [docs/reasoning.md](./docs/reasoning.md) | 為何選 `understanding`、為何一次改名 |

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 新欄位名 | 對外鍵名 **`understanding`**＝`memories/nodes/{id}/understand/what.md` **整檔**正文（standing understanding；期望四段骨架見 0.25） |
| 2 | 遷移 | **一次改名**（破壞性）：HTTP response 與 dream 凍結 context **不再**回傳 `what_current`；changelog 標 breaking |
| 3 | 涵蓋表面 | `GET /memories/nodes/{id}`、`GET /memories/search` → `nodes[]`、dream context `l2_current[]`；web 型別與 Memory／Seek 讀欄位；api-docs／domain-language／AGENTS |
| 4 | Store | 路徑維持 `understand/what.md`；**不** bump `store_version`；**無** migrate |
| 5 | 內部 | `readWhatCurrent` → `readUnderstanding`；`readAllWhatCurrents` → `readAllUnderstandings`（回傳 `{ node, understanding }`） |
| 6 | Alias | **不**雙欄過渡；**不**同時回舊鍵 |
| 7 | 語意 | 與 0.25 相同：整檔正文，**不是**「僅 `## Current situation`」 |

---

## 非目標

- 改 `what.md` 檔名或多 facet 路徑
- 雙欄 alias（`what_current` 與 `understanding` 同值）
- 改 search preview 語意或回傳結構（除鍵名外）
- Store migrate、UI 結構大改
- Node merge、vector search、draft 自由句編輯

---

## 實作軌道

### Track A — Server wire＋內部函式

- **做：** `nodes.ts` 改名讀取函式與回傳鍵；`browse.ts`／`search.ts`／dream `types`／`mock`／`context`／`dream-files.md` 全部改用 `understanding`
- **不要：** 保留 `what_current` 別名；改檔案路徑
- **驗收：** 上述表面 JSON 鍵皆為 `understanding`

### Track B — Web

- **做：** `web/src/lib/api.ts`、`MemoryScene`、`SeekScene` 讀 `understanding`
- **不要：** 改版面或 i18n 文案結構（除非字串直接寫死舊鍵名）
- **驗收：** Memory node detail／Seek node 卡仍顯示整檔正文

### Track C — 文件與出貨

- **做：** `docs/api-docs/`、`docs/domain-language.md`、`AGENTS.md`；`version.md`／`changelog.md`；出貨後刪 backlog 條目；0.25 連結改指本版（可選）
- **不要：** 重寫歷史 roadmap 正文（可留 `what_current` 作史料）
- **驗收：** 活契約 grep 無 `what_current`；checklist 全勾

---

## 驗收

- [x] `GET /memories/nodes/{id}` 與 search `nodes[]` 回 `understanding`（缺 node 時仍 200 + `null`／既有 empty 語意）
- [x] Dream `l2_current[].understanding`；prompt 引用新鍵
- [x] Web Memory／Seek 讀新鍵
- [x] 活契約文件（api-docs／AGENTS／domain-language）無 `what_current`
- [x] **無** `store_version` bump；**無** migrate
- [x] `bun run test:phases`（或既有 mock／self-test）通過
- [x] backlog `node-api-understanding-rename` 已刪；本版狀態 → `shipped`

---

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/src/store/memories/nodes.ts` | `readUnderstanding`／`readAllUnderstandings` |
| `server/src/memory/browse.ts` | node detail response |
| `server/src/seek/search.ts` | search hits |
| `server/src/agent/dream/types.ts`、`mock.ts` | `l2_current` |
| `server/src/dream/execute/context.ts` | 凍結 context |
| `server/prompts/dream-files.md` | prompt 鍵名 |
| `web/src/lib/api.ts`、`MemoryScene.tsx`、`SeekScene.tsx` | 客戶端 |
| `docs/api-docs/api.md` | 契約 |

---

## 與上一版對照

| | 0.25.0 | 0.26.0 |
|--|--------|--------|
| `what.md` 骨架 | 四段 standing understanding | **不變** |
| API 鍵名 | `what_current` | **`understanding`** |
| Store 路徑 | `understand/what.md` | **不變** |
| Store migrate | 無 | **無** |

## 開工前仍須拍板

無。
