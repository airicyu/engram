# 0.18.0 — Seek × 未來視（契約）

← [INDEX](../INDEX.md)

> **做什麼以 INDEX 已定案為準。** 本檔鎖定 HTTP／prompt／UI 形狀，供實作與 api-docs 對齊。

## 背景（0.17 → 0.18）

0.17 起未來視活集合為：

- `memories/future-sight/hot.md`
- `memories/future-sight/later.md`

Seek（search／ask）在 0.17 **不**讀未來視；`memory-ask.md` 明示禁止讀該目錄。  
0.18 打開讀側，並區分：**Search＝便宜 script 全掃兩區**；**Ask＝貴，預設只 hot，later 靠 flag**。

---

## Config：window 預設

| 鍵 | 0.17 預設 | 0.18 預設 |
|----|-----------|-----------|
| `future_sight_window_days` | 90 | **365** |
| `future_sight_hot_days` | 30 | 30（不變） |

優先序不變：**workspace 鍵（若存在）→ 否則 env → 否則預設**。  
已寫 `future_sight_window_days: 90` 的 store **不會**因升級程式而變成 365。

`GET /status`／`GET /memories/future-sight` 若已回報有效窗長，繼續回報**有效值**（可能是 365 或使用者覆寫）。

**無** store 目錄 migrate；**不要求** bump `store_version`。

---

## `GET /memories/search`

### Scope

| Token | 意義 |
|-------|------|
| `l1` | short-term（既有） |
| `nodes` | L2 nodes（既有） |
| `chain` | day／week／month／year（既有） |
| **`future`** | **新增**：掃 `hot.md`＋`later.md` 內各 item（id、正文、fence 內日期字串皆可作 substring 命中） |

- 省略 `scope` → 預設 **`l1,nodes,chain,future`**
- 顯式 `scope` → 僅列舉者；空或未知 → `400 invalid_scope`（行為同現碼）
- **`future` 不可再拆**成只 hot／只 later（本版無此 query）

### 回應：`future_sight`

當且僅當 `future` ∈ 本次 scope 時，JSON **含**鍵 `future_sight`（陣列；無命中為 `[]`）。

建議每筆形狀（實作可微調，但須先改本檔再改碼）：

```json
{
  "id": "game-xx-launch",
  "zone": "hot",
  "anchor_start": "2026-08-01",
  "anchor_end": "2026-08-15",
  "content": "……命中相關正文……",
  "match_reason": "content"
}
```

| 欄位 | 說明 |
|------|------|
| `id` | item id |
| `zone` | `hot` \| `later` |
| `anchor_start`／`anchor_end` | 來自 item yaml fence |
| `content` | item 正文（可截斷；須足夠辨識命中） |
| `match_reason` | 至少區分 `id`｜`content`｜`anchor`（若實作有掃日期欄）；出貨寫進 api-docs |

**排序：** 先全部 hot 命中（近→遠），再全部 later 命中（近→遠）。與 `GET /memories/future-sight` 的 zone 順序精神一致。

Search **不**呼叫 AI；**不**跑 full maintain（若需過期一致，可依賴既有 GET future-sight 之 expire-only；search 本版不強制先 maintain——讀當下檔案即可；過期 item 若仍在檔內可能被命中，與直接讀檔一致）。

---

## `POST /memories/ask`

### Body

| 欄位 | 必填 | 型別 | 預設 | 說明 |
|------|------|------|------|------|
| `q` | 是 | string | — | 既有；空白 → `400 missing_q` |
| **`include_later`** | 否 | **boolean** | **`false`**（省略＝false） | `true`：agent **可讀／應讀** `later.md`；`false`：讀 hot，**禁止**讀 later |

非布林（字串 `"true"`、數字等）→ **`400 invalid_include_later`**（message 說明須為 boolean）。

既有：`ask_busy` → 409；cancel／poll 路徑不變。Job 持久化應記下 `include_later`，供 prompt 與除錯（GET job 可選 echo 該欄；若加 echo，出貨寫 api-docs）。

### Prompt 行為

| `include_later` | 未來視 |
|-----------------|--------|
| `false` | Store map **包含** `memories/future-sight/hot.md`；**明確禁止**讀 `later.md` |
| `true` | Store map **包含** `hot.md` **與** `later.md`；蒐證時對未來檔期類問題應對照兩檔 |

兩態皆須：

- 廢除「Do not read `memories/future-sight/`」總禁
- 仍禁止亂掃整份 `events.jsonl`（維持現精神）
- 仍先 short-term，再依題讀 L2／chain／（允許的）未來視
- **禁止**實作「先答一輪，若自信不足再偷偷讀 later」的兩段管線

### Sources

`sources[].kind` 擴充允許 **`future_sight`**（名稱鎖定）。建議欄位：

```json
{ "kind": "future_sight", "id": "game-xx-launch", "zone": "later", "reason": "…" }
```

既有 `L1`／`L2`／`chain` 不變。解析器對未知 kind 的寬鬆／嚴格策略：至少接受 `future_sight`；出貨時 api-docs 寫明。

---

## UI（Seek）

| 模式 | 控制 |
|------|------|
| Search | scopes 增加 **future**（預設勾選）。結果區渲染 `future_sight` 命中，顯示 **zone** |
| Ask | 控制項綁 `include_later`（預設 **off**）。標籤須表達「含較遠未來視（later）」，避免「進階／深度」等含糊詞 |

不要求 Memory 場景新增未來視主瀏覽（GET 已存在；本版非目標）。

---

## 與「只注 hot」舊 backlog 的關係

舊 backlog 建議「預設只注 hot」。0.18 **部分保留**：Ask **預設**確實只開放 hot。  
但 Search **兩區都掃**；Ask 經 flag 可讀 later——因問句無法判斷答案在哪一區，且 window 預設 365 後 later 承載更多中長期檔期。詳見 [reasoning.md](./reasoning.md)。
