# 0.8.0 — Seek + Memory Browse

← [changelog](../../../changelog.md) · 上游：[0.7.0](../0.7.0/INDEX.md) · current: [version](../../../version.md) · 詞彙：[domain-language.md](../../domain-language.md)

> **狀態：** **shipped（0.8.0）**  
> **讀完本頁 + 兩份子文件即可開工**，無需另附 handoff prompt。

## 產品句

> **尋找**關鍵字或問 AI；**記憶**沿時間軸或節點列表翻閱。讀取路徑分清楚，不再把 Search／Ask／Browse 塞在同一個 Memory tab。

## 文件地圖（閱讀順序）

| # | 文件 | 讀者 | 內容 |
|---|------|------|------|
| 0 | [AGENTS.md](../../../AGENTS.md) | 所有人 | 語言、API 邊界、慣例、禁止手改 store |
| 1 | **本檔 INDEX** | 所有人 | 範圍、定案、驗收、檔案清單 |
| 2 | [docs/browse-api.md](./docs/browse-api.md) | Server | API 契約 + handler 實作細節 |
| 3 | [docs/web-ia.md](./docs/web-ia.md) | Web | IA + HTML/JS/CSS/i18n 實作細節 |

---

## 如何開工

1. 讀 `AGENTS.md` → 本檔 → `browse-api.md` → `web-ia.md`
2. 對照現況程式（見下方「錨點檔案」）
3. 依 **實作軌道** 順序做；每軌道完成後勾 **驗收清單**
4. 全做完：更新 `version.md`（`0.8.0`）、`changelog.md`、`docs/domain-language.md`、`AGENTS.md`
5. 跑 `cd server && bun run test:phases` 必須全過

**操作記憶狀態只打 HTTP API**；勿手改 `data/`、`engram-data/`。

---

## 背景（0.7.0 缺口）

0.7.0 有 `GET /memory/search`、`POST /memory/ask`，但 UI 全塞在 **Memory** 場景。使用者無法瀏覽 day chain 或 L2 nodes，只能 Search（需關鍵字）、Ask（慢）或開檔案。

本版：**Seek**（查詢）與 **Memory**（翻閱）分場景；新增 Browse API。

---

## 已定案（含原「待拍板」— 勿再問）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 頂層場景 | 記下／沉澱／**尋找 Seek**／**記憶 Memory**（四個） |
| 2 | Seek subtab | 搜尋（預設）、提問；API path **不變** |
| 3 | Memory subtab | 記憶鏈（預設）、節點；**不含**搜尋 subtab |
| 4 | Browse 版面 | &lt;48rem stack；≥48rem 左右 split |
| 5 | Memory 容器寬 | `min(56rem, calc(100% - 2rem))`；其他場景維持 `42rem` |
| 6 | 進入記憶鏈 | 拉 index → 選**最新一天** → 載 detail |
| 7 | 節點 filter | **客戶端**即時過濾 id + preview |
| 8 | preview 長度 | **80** 字元（正規化空白後 slice） |
| 9 | 非法 `day_id` | `400 invalid_day_id` |
| 10 | 非法 `node_id` | `400 invalid_node_id` |
| 11 | 合法但無檔案 | `200` + `present: false`（**非** 404） |
| 12 | breakpoint | `48rem` |

---

## 範圍摘要

### 頂層場景（Web）

| 場景 | EN | 職責 | API |
|------|-----|------|-----|
| 記下 | Capture | 寫入 + L1 預覽 | `POST /capture`、`GET /memory/l1` |
| 沉澱 | Consolidate | Dream／Approve／Cancel | 既有 dream API |
| 尋找 | Seek | 關鍵字或 AI 找 | `GET /memory/search`、`POST /memory/ask`（沿用） |
| 記憶 | Memory | 翻閱 chain／nodes | **新增** browse API（見 browse-api.md） |

### 新增 API

| 端點 | 用途 |
|------|------|
| `GET /memory/chain` | day index（新→舊 + preview） |
| `GET /memory/chain/{day_id}` | day detail |
| `GET /memory/nodes` | node index（字母序 + preview） |
| `GET /memory/nodes/{node_id}` | what Current detail |

契約全文：[browse-api.md](./docs/browse-api.md)

---

## 非目標（勿做）

- Node network／graph 視圖
- search all、embedding、future-sight browse
- 改 `/memory/search`、`/memory/ask` 契約
- Memory 場景瀏覽 L1（仍在 **記下**）
- WebSocket、大範圍無關重構

---

## 錨點檔案（改前必讀）

### Server

| 路徑 | 用途 |
|------|------|
| `server/src/index.ts` | 註冊路由、`/` endpoints 列表 |
| `server/src/api/memory/l1.ts` | handler 範例（薄 wrapper） |
| `server/src/api/memory/search.ts` | search handler 範例 |
| `server/src/memory/search.ts` | 業務邏輯層範例 |
| `server/src/store/chain.ts` | `listChainDayIds`、`readDayForRecall` |
| `server/src/store/nodes.ts` | `listNodeIds`、`readWhatCurrent` |
| `server/src/cli/self-test.ts` | 加 Phase 4c browse 測試 |

### Web

| 路徑 | 用途 |
|------|------|
| `web/index.html` | 三場景 → 四場景；拆 `#scene-memory` |
| `web/app.js` | `switchScene`、`switchMemoryMode`、search/ask 邏輯 |
| `web/app.css` | `.app` 寬度、`.memory-modes`、新增 `.browse-*` |
| `web/server.ts` | `/api/*` proxy |
| `web/i18n/en.json`、`zh-Hant.json` | 新 key |

### Docs（實作後必更新）

| 路徑 |
|------|
| `docs/api-docs/api.md`、`docs/api-docs/README.md` |
| `server/README.md` |
| `web/README.md` |
| `docs/domain-language.md` |
| `AGENTS.md` |
| `version.md`、`changelog.md` |

---

## 實作軌道

### Track 1 — Browse API（Server）

**新增檔案（建議）：**

```
server/src/memory/browse.ts          # listChainIndex, getChainDay, listNodesIndex, getNodeDetail
server/src/api/memory/chain.ts       # thin handlers
server/src/api/memory/nodes.ts       # thin handlers（或 chain/nodes 合一 browse.ts）
```

**修改：**

- `server/src/index.ts` — 註冊 4 路由；`fetch` 或 `routes` 處理 `/memory/chain/:day_id`、`/memory/nodes/:node_id`（參考現有 `/memory/ask/:id` 動態路由）
- `server/src/cli/self-test.ts` — Phase 4c：approve 後 chain index/detail、nodes index/detail、invalid day_id → 400

**驗收：**

- [x] 4 端點 JSON 形狀符合 browse-api.md
- [x] 空 store → index `present: false`；detail `present: false`
- [x] `bun run test:phases` 通過

細節：[browse-api.md § 實作](./docs/browse-api.md#實作)

---

### Track 2 — Web IA 重排

**目標：** 四頂層 scene；Seek 承接 search+ask；Memory 留空殼或 placeholder。

**修改：**

- `web/index.html` — 頂欄加 `data-scene="seek"`；`#scene-seek` 包住原 search/ask panel；`#scene-memory` 改 browse
- `web/app.js` — `state.seekMode`；`switchSeekMode`；`switchScene` 支援 `seek`｜`memory`
- `web/i18n/*` — `scene.seek`、遷移 search/ask 文案到 `seek.*`（見 web-ia.md）

**驗收：**

- [x] 四場景可切換
- [x] Seek 搜尋／提問行為與改前等價（同一 API）
- [x] Capture、Consolidate 無回歸

細節：[web-ia.md § 實作](./docs/web-ia.md#實作)

---

### Track 3 — Memory 記憶鏈 Browse

**修改：** `web/index.html`、`app.js`、`app.css`、i18n

**行為：**

- `GET /api/memory/chain` → 渲染列表
- 點 day → `GET /api/memory/chain/{day_id}` → detail
- 預設選最新 day
- responsive layout（web-ia.md CSS）

**驗收：**

- [x] 列表新→舊；選中有視覺狀態
- [x] detail 顯示 content + source meta
- [x] 桌面左右分欄；手機上下

---

### Track 4 — Memory 節點 Browse + filter

**行為：**

- `GET /api/memory/nodes` → 列表
- filter input 客戶端過濾
- 點 node → `GET /api/memory/nodes/{node_id}`

**驗收：**

- [x] filter 縮短列表（match id 或 preview）
- [x] detail 顯示 `what_current`

---

### Track 5 — Docs & release

- [x] `api-docs` 四端點
- [x] `docs/domain-language.md` — Seek、Memory browse
- [x] `AGENTS.md` 場景表
- [x] `version.md` → `0.8.0`；`changelog.md` 條目

---

## 驗證指令

```bash
# API self-test（isolated data-test/）
cd server && bun run test:phases

# 手動（server :8787 + web :8788）
curl -s 'http://localhost:8787/memory/chain' | jq .
curl -s 'http://localhost:8787/memory/chain/2026-07-23' | jq .
curl -s 'http://localhost:8787/memory/nodes' | jq .
curl -s 'http://localhost:8787/memory/nodes/engram' | jq .
```

---

## 與 0.7.0 的關係

| 0.7.0 | 0.8.0 |
|-------|-------|
| Memory UI = Search + Ask | 拆為 Seek + Memory |
| 無 browse API | 新增 chain/nodes read API |
| `/memory/search`、`/memory/ask` | **契約不變** |

---

**狀態：** shipped — `version.md` = `0.8.0`

**上游：** [0.7.0](../0.7.0/INDEX.md)（shipped）
