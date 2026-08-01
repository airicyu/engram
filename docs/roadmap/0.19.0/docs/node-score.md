# Node 活躍分 — 存檔、常數、公式

← [INDEX](../INDEX.md)

> **做什麼以 INDEX 已定案為準。** 本檔寫路徑、常數、純 script 行為與邊界，供實作與測試對照。

## 與未來視的區隔

| | Node score（本版） | Future-sight hot／later |
|--|-------------------|-------------------------|
| 對象 | `memories/nodes/{id}` | 近程錨點兩檔 |
| 維度 | 沉澱活躍（dream 結算次數／強度） | 日曆距離 |
| 產品名 | 活躍分／score | 未來視；**勿**稱 node 為 hot node |

## 磁碟佈局

```
memories/
├── node-score-registry.yaml    # 全域 max 等
└── nodes/
    └── {id}/
        ├── node.meta.yaml
        ├── understand/what.md
        └── score.yaml          # 本版新增
```

### `score.yaml`

```yaml
score: 100
score_timestamp: "2026-08-01T12:00:00.000+08:00"  # ISO-8601；approve／downscale／migrate 寫入
```

- `score`：非負數（實作可用 number；建議存整數或固定小數，全庫一致）。
- 缺檔：視為尚未初始化（migrate 應補齊；runtime 若遇到既有 node 缺檔，**補 `S0` 再繼續**該次結算，並記 log——防漏 migrate）。

### `node-score-registry.yaml`

```yaml
max_score: 100
# 可選：updated_at
```

- `max_score` 為全體 node 帳面分之 **最大值快取**；每次 increment／downscale／migrate／新建後必須更新為 **重掃或等價正確值**。
- 檔不存在：等同未初始化（見空庫）。

`listNodeIds` 只列 **目錄**；registry 是 `memories/` 下檔案，不會被當成 node id。

## 常數（v1 預設）

| 鍵（邏輯名） | 值 | 說明 |
|--------------|-----|------|
| `S0` | 100 | 新建／migrate 預設 |
| `S_min` | 50 | downscale 地板（`0.5 × S0`） |
| `S_target` | 1000 | 降標度目標水位 |
| `S_max` | 2000 | 超過則觸發 downscale |
| `boost.mention` | 10 | |
| `boost.update` | 35 | |
| `boost.focus` | 80 | |

約束（啟動或結算前断言）：`S_min ≤ S0 ≤ S_target < S_max`，且所有 boost `> 0`。

本版可 **寫死在 server**（INDEX #5）。若後版加配置，優先序對齊 timezone：`workspace → 否則 env → 否則上表`。

## Category

| id | 語意 | 判準（給 prompt／人審） |
|----|------|------------------------|
| `mention` | 帶過 | 有提到，但非本輪主線；該 node 理解幾乎未改 |
| `update` | 理解有實質更新 | 重要事實寫進該 node 長期理解（draft 實質動 `what.md`） |
| `focus` | 本輪焦點 | 敘事／事件主體之一；拿掉它本段情節難成立 |

順序（max）：`focus` > `update` > `mention`。

非法 category 字串：

| 入口 | 行為 |
|------|------|
| Extract 收尾讀 artifact | **失敗 → 不進 `pending_review`**（不會走到 approve 結算） |
| 2a `PATCH` | **400** `invalid_category`（或等價碼；出貨寫 api-docs） |

純 script 結算假設 category 已合法（pending 閘門＋2a 校验）；防衛性若仍讀到非法 → 視為實作 bug，應 fail 該 approve（勿默默當 mention）。

## 純 script：increment（單 node）

僅用於 **本場前已存在** 的 node：

```text
new_score = old_score + boost[category]
寫回 score.yaml；score_timestamp = as_of
```

無時間項。不在此函式處理新建、不在此函式 downscale。

## 純 script：downscale（獨立 flow）

輸入：`as_of: string`；`exclude_node_ids?: string[]`（預設空＝不排除）。

```text
若無任何 score 檔且無 max → no-op，return
重掃（或讀 registry 後校對）得 max_score
若 max_score ≤ S_target → no-op，return          # 防 factor<1 升分
factor = max_score / S_target
for each node with score.yaml:
  if id ∈ exclude_node_ids: continue
  score = max(score / factor, S_min)
  score_timestamp = as_of
重掃全體（含 exclude）寫回 registry.max_score
```

- **不**讀 dream_run、**不**解析 draft。
- 呼叫方（approve 編排）負責傳入「本場新建 id」作 exclude。

## Display

```text
若 max_score 缺失或 ≤ 0 → display = null（UI：—）
否則 display = ceil(score / max_score * 100)
```

`score > 0` 時 display ≥ 1。不需再 `max(1, …)`。

## 空庫與首場

| 狀態 | 行為 |
|------|------|
| 0 node | 無 registry 可；不 downscale；browse 空列表 |
| 僅新建若干 | 各 `S0`；`max_score = S0`；不觸發 downscale（`S0 < S_max`） |
| 缺 registry 但有 score 檔 | 重掃重建 max |

## 維護 max_score

| 事件 | 動作 |
|------|------|
| 新建 `S0` | `max_score = max(max_score, S0)` 或重掃 |
| increment | 若 `new > max_score` 更新；或重掃 |
| downscale | **必須重掃**（有 `S_min`／exclude，不能假設等於 `S_target`） |
| 刪 node（本版若無 API） | 後版 merge／刪除時必須重掃；本版註明債務即可 |
