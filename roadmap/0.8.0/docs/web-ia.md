# Web IA — 四場景 + Seek／Memory

← [INDEX](../INDEX.md)

## 頂層導覽

```
┌─────────────────────────────────────────────────────────┐
│ Engram    [ 記下 ] [ 沉澱 ] [ 尋找● ] [ 記憶 ]    status │
└─────────────────────────────────────────────────────────┘
```

| data-scene | i18n key（zh-Hant） | EN | 說明 |
|------------|---------------------|-----|------|
| `capture` | `scene.capture` → 記下 | Capture | 不變 |
| `consolidate` | `scene.consolidate` → 沉澱 | Consolidate | 不變 |
| `seek` | `scene.seek` → **尋找** | Seek | 原 Memory 的 Search + Ask |
| `memory` | `scene.memory` → 記憶 | Memory | Browse only |

頂欄 `.scenes` 由 **3** 個 `scene-btn` 改 **4** 個。窄屏 `flex-wrap`。

---

## Seek（尋找）

```
尋找 (#scene-seek)
├── [ 搜尋 ● ] [ 提問 ]     data-seek-mode: search | ask
├── #seek-search-panel      ← 原 #memory-search-panel
└── #seek-ask-panel         ← 原 #memory-ask-panel
```

| subtab | `data-seek-mode` | 預設 | API |
|--------|------------------|------|-----|
| 搜尋 | `search` | **是** | `GET /memory/search` |
| 提問 | `ask` | | `POST /memory/ask` + poll |

Search／Ask **表單與邏輯不變**，僅搬 DOM 與 i18n 前綴。元素 ID 建議改 `seek-*`（見 § DOM 遷移）；或短期保留 `memory-search-*` ID 減 diff（二選一，**整檔一致即可**）。

---

## Memory（記憶）

```
記憶 (#scene-memory)
├── [ 記憶鏈 ● ] [ 節點 ]   data-memory-mode: chain | nodes
└── .browse-layout
      ├── .browse-index
      └── .browse-detail
```

### 記憶鏈

- `GET /api/memory/chain` → 列表
- 點 day → `GET /api/memory/chain/{day_id}`
- 進入 tab：index → 選 `days[0]`（最新）→ detail
- detail 標題：`day_id`；meta 顯示 `source`

### 節點

- `GET /api/memory/nodes` → 列表
- `#memory-nodes-filter`：client-side filter（match `node` + `preview`，case-insensitive）
- 點 node → `GET /api/memory/nodes/{node_id}`

---

## Responsive layout

### 窄（&lt; 48rem）— stack

列表在上、detail 在下。

### 寬（≥ 48rem）— split

```css
.browse-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 48rem) {
  .browse-layout {
    display: grid;
    grid-template-columns: minmax(11rem, 14rem) 1fr;
    align-items: start;
    min-height: 20rem;
  }
  .browse-index {
    max-height: min(70vh, 28rem);
    overflow-y: auto;
  }
}

.browse-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  cursor: pointer;
  margin-bottom: 0.35rem;
}

.browse-item.is-selected {
  border-color: rgba(31, 107, 99, 0.35);
  background: rgba(31, 107, 99, 0.08);
}

.browse-item-preview {
  font-size: 0.8rem;
  color: var(--ink-muted);
  margin-top: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### App 寬度

```css
/* 預設窄欄不變 */
.app { width: min(42rem, calc(100% - 2rem)); }

/* Memory 場景時加在 .app */
.app.app-wide {
  width: min(56rem, calc(100% - 2rem));
}
```

`switchScene("memory")` → `document.querySelector(".app").classList.add("app-wide")`；其他 scene → `remove`。

---

## 實作

### 修改檔案

| 路徑 | 變更 |
|------|------|
| `web/index.html` | 四 scene；`#scene-seek`；`#scene-memory` browse  markup |
| `web/app.js` | state、switch、browse 載入、filter |
| `web/app.css` | `.app-wide`、`.browse-*` |
| `web/server.ts` | browse proxy（見 browse-api.md） |
| `web/i18n/en.json`、`zh-Hant.json` | 新 key |
| `web/README.md` | 場景表 |

### DOM 遷移（建議 ID）

| 現有 | 0.8.0（建議） | 所屬 scene |
|------|---------------|------------|
| `#scene-memory`（含 search+ask） | `#scene-seek` | seek |
| `#memory-search-panel` | `#seek-search-panel` | seek |
| `#memory-ask-panel` | `#seek-ask-panel` | seek |
| `#memory-search-form` | `#seek-search-form` | seek |
| `#memory-ask-form` | `#seek-ask-form` | seek |
| — | `#scene-memory`（新） | memory |
| — | `#memory-chain-panel` | memory |
| — | `#memory-nodes-panel` | memory |
| — | `#memory-chain-index` | memory |
| — | `#memory-chain-detail` | memory |
| — | `#memory-nodes-index` | memory |
| — | `#memory-nodes-filter` | memory |
| — | `#memory-nodes-detail` | memory |

頂欄新增：

```html
<button type="button" class="scene-btn" data-scene="seek" … data-i18n="scene.seek">尋找</button>
<button type="button" class="scene-btn" data-scene="memory" … data-i18n="scene.memory">記憶</button>
```

（原單一 Memory 按鈕拆成 Seek + Memory。）

### `app.js` state

```javascript
// 現有
state.scene          // "capture" | "consolidate" | "seek" | "memory"
state.seekMode       // "search" | "ask"     （新）
state.memoryMode     // "chain" | "nodes"    （改義：原 search|ask）

// browse 快取（可選）
state.chainDays      // last index response
state.nodesList      // last index response
state.selectedDayId
state.selectedNodeId
```

### 函式

| 函式 | 職責 |
|------|------|
| `switchScene(name)` | 切頂層；`memory` 時 `app-wide`；進 memory 呼叫 `loadMemoryChain()` 或依 `memoryMode` |
| `switchSeekMode(mode)` | 顯示 search／ask panel |
| `switchMemoryMode(mode)` | 顯示 chain／nodes panel；`chain` 時 `loadChainIndex()` |
| `loadChainIndex()` | `GET /api/memory/chain` → render index → 選首項 → `loadChainDay(id)` |
| `loadChainDay(dayId)` | `GET /api/memory/chain/{id}` → render detail |
| `loadNodesIndex()` | `GET /api/memory/nodes` → render；套用 filter |
| `loadNodeDetail(nodeId)` | `GET /api/memory/nodes/{id}` |
| `onNodesFilterInput()` | 過濾 `state.nodesList` 重繪 index（不打 API） |

**保留不變：** `onMemorySearch`、`onMemoryAsk`、`onMemoryAskCancel`、`renderSearchPacket` 等（僅改 panel 顯示條件為 `seekMode`）。

### 事件綁定（init）

```javascript
document.querySelectorAll("[data-scene]").forEach(… switchScene …);
document.querySelectorAll("[data-seek-mode]").forEach(… switchSeekMode …);
document.querySelectorAll("[data-memory-mode]").forEach(… switchMemoryMode …);
$("seek-search-form").addEventListener("submit", onMemorySearch);
$("seek-ask-form").addEventListener("submit", onMemoryAsk);
// …
$("memory-nodes-filter").addEventListener("input", onNodesFilterInput);
```

### i18n 新增 key

| key | en | zh-Hant |
|-----|-----|---------|
| `scene.seek` | Seek | 尋找 |
| `seek.lead` | Find by keyword or ask AI. | 用關鍵字搜尋，或向 AI 提問。 |
| `seek.mode_search` | Search | 搜尋 |
| `seek.mode_ask` | Ask | 提問 |
| `memory.lead` | Browse day chain and nodes. | 翻閱記憶鏈與節點。 |
| `memory.mode_chain` | Day chain | 記憶鏈 |
| `memory.mode_nodes` | Nodes | 節點 |
| `memory.nodes_filter` | Filter nodes | 篩選節點 |
| `memory.chain_empty` | No days in chain yet. | 尚無記憶鏈。 |
| `memory.nodes_empty` | No nodes yet. | 尚無節點。 |
| `memory.browse_loading` | Loading… | 載入中… |
| `memory.browse_fail` | Failed to load | 載入失敗 |
| `memory.source_summary` | summary | summary |
| `memory.source_ledger` | ledger | ledger |

**遷移：** `memory.mode_search` / `memory.mode_ask` → 改引用 `seek.mode_*`；`memory.search_lead` → `seek.lead`（或保留舊 key 一版 alias 避免漏改）。

`scene.memory` 中文維持 **記憶**；英文仍 Memory。

### Memory chain panel HTML 骨架

```html
<div id="memory-chain-panel">
  <div class="browse-layout">
    <div class="browse-index" id="memory-chain-index" role="listbox" aria-label="…"></div>
    <article class="browse-detail packet-block" id="memory-chain-detail">
      <h2 id="memory-chain-detail-title">—</h2>
      <p class="browse-meta" id="memory-chain-detail-meta"></p>
      <pre class="md-block" id="memory-chain-detail-body" data-i18n="memory.browse_loading">載入中…</pre>
    </article>
  </div>
</div>
```

Nodes panel 類似，index 上方加 filter input。

### 無障礙

- 頂層／subtab：`role="tablist"` + `aria-selected`
- 列表項：`role="option"` 或 button + `aria-current="true"` 當選中
- filter：`aria-label` = `memory.nodes_filter`

---

## 非 UI 範圍

- API path 不因場景改名
- 記憶內容不翻譯
- 不做 graph

---

## 手動驗收（Web）

1. 四頂層 tab 可切換，Capture／Consolidate 行為不變
2. Seek → 搜尋：輸入關鍵字有結果（與改前一致）
3. Seek → 提問：mock 或 live ask 可完成
4. 記憶 → 記憶鏈：見 day 列表；點選載入 detail；桌面左右分欄
5. 記憶 → 節點：filter 可縮列表；點選載入 what
6. 視窗拉寬／縮窄：layout 在 stack ↔ split 切換
