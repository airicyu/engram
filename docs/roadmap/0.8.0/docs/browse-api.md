# Browse API — 記憶鏈 + 節點

← [INDEX](../INDEX.md)

讀取型端點，供 Memory 場景 **翻閱**。與 `GET /memory/search`（keyword 命中）分工。

**原則：**

- Index **輕量**（id + preview）；detail **按需**
- 無資料 → **200** + `present: false` 或空陣列（不用 404 表示「沒內容」）
- 路徑／參數不合法 → **400**
- 不暴露 future-sight、不掃全庫 L0 events

---

## `GET /memory/chain`

Day chain **索引**（新→舊）。

**Query：** 無（第一版不分頁）。

**Response `200`**

```json
{
  "days": [
    {
      "day_id": "2026-07-23",
      "preview": "Engram 0.6.0 dream entry…",
      "source": "summary"
    },
    {
      "day_id": "2026-07-20",
      "preview": "<!-- patch:p001 -->…",
      "source": "ledger_fallback"
    }
  ],
  "present": true
}
```

| 欄位 | 說明 |
|------|------|
| `days` | 排序：**day_id 降序**（新→舊） |
| `day_id` | `YYYY-MM-DD` |
| `preview` | 截斷 **80** 字元（見 § preview  helper） |
| `source` | `summary` \| `ledger_fallback` |
| `present` | `days.length > 0` |

空 store → `{ "days": [], "present": false }`。

---

## `GET /memory/chain/{day_id}`

單日 **detail**。

**Path：** `day_id` 須符合 `^\d{4}-\d{2}-\d{2}$`，否則 `400 invalid_day_id`。

**Response `200`（有內容）**

```json
{
  "day_id": "2026-07-23",
  "content": "…markdown…",
  "source": "summary",
  "present": true
}
```

**Response `200`（無此日檔案）**

```json
{
  "day_id": "2026-07-23",
  "content": null,
  "source": "empty",
  "present": false
}
```

---

## `GET /memory/nodes`

L2 node **索引**（id 升序）。

**Response `200`**

```json
{
  "nodes": [
    { "node": "engram", "preview": "Release cadence…" },
    { "node": "acme", "preview": "Pricing…" }
  ],
  "present": true
}
```

空 → `{ "nodes": [], "present": false }`。

---

## `GET /memory/nodes/{node_id}`

單 node **detail**。

**Path：** 安全目錄名（不含 `/`、`\`、`..`、空字串）；非法 → `400 invalid_node_id`。

**Response `200`（存在）**

```json
{
  "node": "engram",
  "what_current": "…markdown…",
  "present": true
}
```

**Response `200`（不存在）**

```json
{
  "node": "engram",
  "what_current": null,
  "present": false
}
```

只回 **Current** section。

---

## 錯誤回應

| 狀態 | `error` | 何時 |
|------|---------|------|
| 400 | `invalid_day_id` | day_id 非 `YYYY-MM-DD` |
| 400 | `invalid_node_id` | node_id 非法字元 |

Body 範例：`{ "error": "invalid_day_id", "message": "…" }`（message 可簡短英文，對齊 search handler）。

---

## 與 Search 的差異

| | Browse | Search |
|--|--------|--------|
| 觸發 | 列表點選 | `q` 必填 |
| 輸出 | 單筆完整 detail | 多處命中片段 |
| L1 | 不含 | `scope=l1` 可含 |

---

## 實作

### 新增／修改檔案

| 動作 | 路徑 |
|------|------|
| 新增 | `server/src/memory/browse.ts` |
| 新增 | `server/src/api/memory/chain.ts` |
| 新增 | `server/src/api/memory/nodes.ts` |
| 修改 | `server/src/index.ts` |
| 修改 | `server/src/cli/self-test.ts` |
| 修改 | `docs/api-docs/api.md`、`docs/api-docs/README.md`、`server/README.md` |

### `browse.ts` 建議匯出

```typescript
const PREVIEW_MAX = 80;

function previewText(text: string, max = PREVIEW_MAX): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "";
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

export function isValidDayId(id: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(id);
}

export function isValidNodeId(id: string): boolean {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return true;
}

// listChainIndex(): Promise<{ days, present }>
// getChainDay(dayId): Promise<{ day_id, content, source, present }>
// listNodesIndex(): Promise<{ nodes, present }>
// getNodeDetail(nodeId): Promise<{ node, what_current, present }>
```

**Store 複用（勿重寫 I/O）：**

| 函式 | 來源 |
|------|------|
| `listChainDayIds()` | `store/chain.ts` |
| `readDayForRecall(day_id)` | `store/chain.ts` |
| `listNodeIds()` | `store/nodes.ts` |
| `readWhatCurrent(node_id)` | `store/nodes.ts` |
| `nodeExists(node_id)` | `store/nodes.ts`（detail present 判斷可選） |

**index 的 `source`：** 與 `readDayForRecall` 回傳一致；`empty` 的 day 不進 index。

### 路由註冊（`server/src/index.ts`）

1. `routes` 靜態路徑：

```typescript
"/memory/chain": { GET: … listChainIndex … },
"/memory/nodes": { GET: … listNodesIndex … },
```

2. 動態路徑 — 沿用 ask 的 `fetch` 模式或等價：

```typescript
// /memory/chain/2026-07-23
// /memory/nodes/engram
const chainMatch = url.pathname.match(/^\/memory\/chain\/([^/]+)$/);
const nodesMatch = url.pathname.match(/^\/memory\/nodes\/([^/]+)$/);
```

3. 更新 `GET /` 的 `endpoints` 陣列，加入四條。

4. 可選 `logMemory("browse chain", …)` / `logMemory("browse nodes", …)` 於 index／detail。

### Handler 範例（薄層）

對齊 `api/memory/search.ts`：`handleChainIndex()`、`handleChainDay(dayId)` 回傳資料或 `{ error: "invalid_day_id" }`；`index.ts` 轉 400 JSON。

### self-test（Phase 4c，插在 Phase 4b 之後）

在已有 approve 寫入 chain + L2 的 phase 2 資料上（或 Phase 4b 後再跑一次 mini flow）：

```text
GET /memory/chain           → 200, days.length >= 1, present true
GET /memory/chain/{day}     → 200, present true, content 非空
GET /memory/nodes           → 200, nodes 含測試用 node（如 acme）
GET /memory/nodes/acme      → 200, present true
GET /memory/chain/not-a-date → 400 invalid_day_id
GET /memory/nodes/          → 400 或路由不匹配（勿 500）
```

空 store 單測可另開 isolated server（與 Phase 0 類似）assert `present: false`。

### Web proxy（`web/server.ts`）

新增：

```typescript
"/api/memory/chain": {
  GET: (req) => proxyApi(req, "/memory/chain"),
},
"/api/memory/nodes": {
  GET: (req) => proxyApi(req, "/memory/nodes"),
},
```

`fetch` 補動態：

```typescript
// /api/memory/chain/:day_id
// /api/memory/nodes/:node_id
```

對齊現有 `/api/memory/ask/:job_id` 寫法。

---

## 刻意不做（本版）

- 分頁 `?limit=`
- server-side node filter
- ledger／summary 雙端點
- 404 表示「無內容」
