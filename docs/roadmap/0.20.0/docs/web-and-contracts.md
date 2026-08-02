# 0.20.0 — Web 與 API 客戶端

← [INDEX](../INDEX.md) · 閘門：[phase-gates.md](./phase-gates.md)

> Phase 5 HOW。保持四場景工作台；修非同步與邊界，不做視覺大改。

---

## 1. Ask job 生命週期

### 現況問題

- `web/src/scenes/SeekScene.tsx`：`while`＋`setTimeout` 輪詢；scene 卸載後仍可能 `setState`。
- 重整或切走再回來：`StatusContext` 可能知道 `ask_job`，但 UI 未 resume，也難 cancel。

### 目標

抽出 **`useAskJob`**（或 `AskJobContext`，二選一，避免兩處各寫輪詢）：

| 行為 | 要求 |
|------|------|
| start | `POST /memories/ask` 後進入 polling |
| poll | 間隔與現況相近（約 2.5s）；讀 job 狀態直到 terminal |
| cleanup | unmount／Strict Mode 重掛時中止；不得對卸載元件 setState |
| resume | 掛載時若 status 顯示 running ask → 接上 job id 繼續 poll |
| cancel | 呼叫既有 cancel API（若有）並停止 poll |

`StatusContext` 只保留 server snapshot 與必要的「有 job 在跑」衍生旗標；**不要**再讓 Scene 與 Context 各管一套 timer。

### 驗收

[phase-gates G5.1–G5.2](./phase-gates.md#phase-5--web)。

---

## 2. MemoryScene

### 現況問題

- 多 state 並列；在 `setSelectedChainId` updater 內觸發 `loadChainDetail`（React 反模式；Strict Mode 可雙重執行）。
- `eslint-disable` 壓過 hook deps。
- 無 AbortController／序號 → 快速切換會顯示舊回應。

### 目標

1. **移除** updater 內副作用：選取 id 用普通 setState；`useEffect(id)` 負責 load。
2. 每次 load 帶 **abort 或 requestSeq**；過期回應丟棄。
3. 可拆 `ChainBrowser`／`NodesBrowser`（或 `useChainBrowser` hook）——若時間緊，**修完 1–2 即可過閘**，拆檔為加分。

### 驗收

G5.3；靜態檢查無 updater-fetch。

---

## 3. ConsolidateScene

### 現況

約 400+ 行：run／approve／discard／retry／cancel／2a／進度 UI 混雜。

### 本版最低

- 抽出 `useDreamActions`（或同檔上方的 action helpers）統一 `{ ok, status, data }`／409 處理。
- 不強制視覺拆多元件到「完美」；**禁止**再往 Scene 塞新產品功能。

---

## 4. Endpoint-oriented API client

### 現況

`web/src/lib/api.ts` 僅泛型 `fetch`；path／型別散落各 Scene。

### 目標（本版最低）

```ts
// 示例形狀，非強制 API 名
api.activities.create({ raw, node_refs? })
api.dreams.run()
api.dreams.pending()
api.memories.search({ q, scope? })
api.memories.ask({ q, include_later? })
api.memories.askJob(id)
api.memories.chain.index(level)
// …
```

- 統一錯誤形狀（status＋body／message）。
- 支援傳入 `AbortSignal`。
- 型別與 `docs/api-docs/api.md`／server 回應對齊；**不**要求本版抽獨立 package。

Production `web/server.ts` proxy：若改動成本低，改為泛用 `/api/*` 轉發；否則至少文件註明「新增端點須改 allow-list」，本版可不硬改。

---

## 5. 非目標（Web）

- 重設計 CSS／品牌視覺
- 把 Memory 做成分數排行榜 dashboard
- E2E 瀏覽器套件（Playwright 等）——手動閘門可接受
