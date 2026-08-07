# 調查 memo：node 為何只有 what（無其他 facet／區塊）

← [0.25.0 INDEX](../INDEX.md) · 原 backlog 調查（已結案；真相以本版＋[0.26.0](../../0.26.0/INDEX.md) 為準）

**狀態：** 調查完成（2026-08-07）。**0.25** 定案短期維持 **what-only**（單檔 standing understanding）；多 facet 復辟不在本版。殘餘產品取捨見文末與 [reflective-cognition-prompts](../../backlog/reflective-cognition-prompts.md)。

## 題目

Memory／Seek UI 上的 **node 區塊**只顯示 **`what.md`／`understanding`** 敘事；`understand/` 下也幾乎只有 `what.md`。其他在設計文件出現過的 facet（who／why／favor／problems／when／how／open）與 `chronology/` 在產品上不可見。

本調查釐清：**這是刻意的 MVP 收斂、實作缺口、還是兩者兼有**；若將來要擴充，應從哪一層下手（extract 契約、materialize、API、UI）。

---

## 調查 memo（2026-08-07）

### 結論（TL;DR）

| 問題 | 答案 |
|------|------|
| 為何只有 what？ | **刻意 MVP + 全鏈只實作 what**；非單一 bug |
| 是 agent 沒寫其他 facet 嗎？ | **無法寫**：現行 dream（0.16+ file pipeline）prompt 只允許改 `nodes/*/understand/what.md` |
| 舊 JSON patch 路徑？ | **已退役**：`extract.md`／`appendPatches` 不再參與入夢；`legacy/schema.ts` 僅存檔 |
| `open.md`／`resolve_open`？ | **幽靈語意**：舊 prompt 有 `resolve_open`，現管線無 `open.md` 讀寫 |
| `chronology/`？ | **腳手架未接線**：`seedNode` 會建目錄但 **從未被呼叫**；真實 store 無任何 `chronology/` 檔 |
| 真實資料長怎樣？ | 抽樣 node **皆僅** `what.md`；內容常混雜關係／職業／時間軸（見下；**不引原文**） |

**產品方向（0.25 已定）：** 維持 what-only；把單檔做成 standing understanding（四段骨架）。若再擴充，優先釐清 **open／未釐清** 是否走 [reflective-cognition-prompts](../../backlog/reflective-cognition-prompts.md)，再決定是否恢復多 facet 檔。

### 1. 設計意圖（文件）

0.1 規劃 `understand/` 八個 facet，**MVP 只做 `what.md`**，其餘標「後期」（`docs/roadmap/0.1.0/docs/nodes.md`）。

0.4 明確 **不開 `when.md`**，遠景改分流到 `what` 或 chain。`docs/domain-language.md` 亦寫「facet 多數尚未實作」。

### 2. 現行 dream 管線（0.16+ file pipeline）

**實際 prompt：** `server/prompts/dream-files.md`（**非** `extract.md`）。

Agent 的 `file_update` **僅列**：

- `nodes/*/understand/what.md`
- `*.summary.md`、future-sight `hot.md`／`later.md`

無其他 facet 路徑；新 node 由 agent 在 draft 寫 `what.md`＋`node.meta.yaml`＋`INDEX.md`（見 mock runner）。

`server/prompts/extract.md` 仍要求 `facet: "what"`，但 **repo 內無引用**；`store/dreams/patches.ts` 的 `appendPatches` **亦無呼叫者** — 屬 legacy 存檔。

### 3. Store／API／UI 全鏈

| 層 | 行為 | 錨點 |
|----|------|------|
| **讀寫** | 僅 `readUnderstanding`／`whatPath` | `server/src/store/memories/nodes.ts` |
| **seedNode** | 可建 `chronology/` + `what.md`，但 **grep 零呼叫** | 同上 |
| **approve** | `commitDraft` 機械複製 draft 檔；不補 facet 骨架 | `server/src/store/dreams/draft.ts` |
| **API** | `GET /memories/nodes` → `preview`；detail → `understanding` only（0.26） | `server/src/memory/browse.ts`、`docs/api-docs/api.md` |
| **Search** | node 命中只附 `understanding` | `server/src/seek/search.ts` |
| **Ask** | prompt 只列 `what.md` | `server/prompts/memory-ask.md` |
| **UI** | Memory／Seek 只 render `understanding` | `web/src/scenes/MemoryScene.tsx`、`SeekScene.tsx` |

### 4. 目錄形狀抽樣（調查當日；不引正文）

```
memories/nodes/{id}/
├── INDEX.md
├── node.meta.yaml
├── score.yaml          # 0.19+
└── understand/what.md  # 唯一 understand 檔
```

**無** `chronology/`、**無** 其他 facet 檔。

內容觀察（結構層級；**不引 live 正文**）：

| node | 備註 |
|------|------|
| **人物 node** | 關係、職業、健康事件易混在同一 `what.md` |
| **專案 node** | 易寫成版本發布時間軸（設計上可能屬 chain，非 node what） |
| **自我／身份 node** | 身份＋雇主邊界常模糊（who／what） |
| **其餘** | 常見單段定義型敘事 |

→ 現階段 **認知單桶化** 是實際行為，不只是「還沒做 UI」。

### 5. 幽靈／死碼清單

| 項目 | 狀態 |
|------|------|
| `resolve_open` operation | 在 `legacy/schema.ts`；file pipeline 無對應檔案 |
| `episodic` patch → chronology | 0.1 prototype 標 P1–P2 不 apply；現管線無 |
| `seedNode()` | 定義存在，無呼叫 |
| `patches.jsonl` append | 無現行寫入路徑 |
| `extract.md` JSON array 輸出 | 已被 file pipeline 取代 |

### 6. 若擴充：建議決策順序（非定案）

1. **維持 what-only** — 在 prompt 引導結構化小標是否足夠？（**0.25：四段骨架**）
2. **`open`／未釐清** — 獨立 `open.md` vs [reflective-cognition-prompts](../../backlog/reflective-cognition-prompts.md) inbox？
3. **時間語意** — `when.md` vs 留在 chain／future-sight（0.4 已傾向後者）
4. **chronology** — 恢復 episodic 寫入 vs 廢棄目錄約定
5. **橫切** — Search／Ask／activation 讀哪些 facet；API 是否 `understand: { what, open, … }`

---

## 待 brainstorm（若將來再開多 facet）

| 面向 | 待決 |
|------|------|
| **策略** | 維持 what 單桶 vs 漸進 facet vs 廢棄 0.1 多檔設計 |
| **open** | `open.md` vs 反思補問 backlog |
| **chronology** | 接 episodic vs 從 node 骨架移除 |
| **遷移** | 既有 `what.md` 是否／如何拆 facet |
| **UI** | tabs vs 單頁多區 vs 維持現狀 |

## 非目標（本調查）

- 直接實作多 facet
- 改 store_version migrate（除非產品定案）
- 與 node merge／network graph 綁定排程

## 相關

- [0.25 standing understanding](./standing-understanding.md) — 單檔做對
- [AI 反思與認知補問](../../backlog/reflective-cognition-prompts.md) — 「未釐清」可能重疊 `open.md` 語意
- [Vector／語意搜尋](../../backlog/vector-semantic-search.md) — 索引對象目前寫死 `what.md`

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `docs/roadmap/0.1.0/docs/nodes.md` | 原始多 facet 設計 |
| `server/prompts/dream-files.md` | **現行** dream 可寫路徑（僅 what） |
| `server/prompts/extract.md` | legacy JSON patch（未使用） |
| `server/src/store/memories/nodes.ts` | 讀寫與 seed（未呼叫） |
| `web/src/scenes/MemoryScene.tsx` | UI 只顯示 understanding |
| `docs/api-docs/api.md` | API 契約 |
