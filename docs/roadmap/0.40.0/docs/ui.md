# 0.40.0 — 未來視瀏覽（HOW）

做什麼以 [INDEX](../INDEX.md) 為準。本檔鎖定 hash 與畫面結構，避免實作猜 CSS 語意。

## Hash

| Hash | 記憶 mode | 選中 |
|------|-----------|------|
| `#/memory` | chain（預設） | 與 0.37 相同 |
| `#/memory/chain/…` | chain | 不變 |
| `#/memory/nodes`、`#/memory/nodes/{id}` | nodes | 不變 |
| `#/memory/future` | future | 無 id：有錨則可 replace 選第一則（upcoming 第一或整表第一，即 `anchors[0]`）；無錨不選 |
| `#/memory/future/{id}` | future | 選該 id；不在列表則仍顯示該 mode，右欄「找不到」 |

`serializeHash`：`mode=future` 且有 id → `#/memory/future/{encodeHashId(id)}`；無 id → `#/memory/future`。

切 pill「未來視」→ push `#/memory/future` 或帶上目前已選 id。切回鏈／節點寫既有 hash。

## Memory 頂列

```
[ 記憶鏈 ] [ 節點 ] [ 未來視 ]
```

未來視 **沒有** 第二列粒度 pills（沒有日／週）。不要把 upcoming／longTerm 做成第二列 pill（那會變成「一次只看一區」）；分組在列表內完成。

`memory.lead`：說明可翻閱鏈、節點與未來視（三件事）。

## 未來視雙欄

```
+---------------------------+------------------------------+
| 即將                      |  meta：id · zone · 日期區間    |
|  [日期] 預覽…             |  MdBlock(content)             |
|  [日期] 預覽…             |                              |
| 長遠                      |                              |
|  [日期] 預覽…             |                              |
+---------------------------+------------------------------+
```

- 日期顯示：`anchor_start`＝`anchor_end` 則單日；否則 `start – end`（與週鏈 range 同類）。
- 預覽：`content` 首行或截斷空白折疊後前數十字；右欄全文。
- 列表左側：分組標題即將／長遠；卡片內不必再重複 zone 標籤（右欄 meta 可帶 zone）。
- 選中：`browse-item is-selected` 與鏈相同。
- 載入中／失敗：複用 `memory.browse_loading`／`browse_fail`。

空錨虛構導語方向（勿抄 live）：「尚無前瞻錨點。入夢寫入後會出現在這裡。」

## 資料

開頁／切到 future mode：

```
GET /memories/future-sight
```

使用 `anchors[].id|zone|anchor_start|anchor_end|content`（`zone`＝`upcoming`｜`longTerm`）。忽略 `swept_expired`（不必 toast）。`window_days`／`upcoming_days` 本版 UI 不展示（避免做成設定面板）。

## Seek

Search 區塊「未來視」每筆：可點的話用 `<a href="#/memory/future/{id}">` 或同等 `onRouteChange`。Ask sources 列 `kind=future_sight` 且有 `id` 同理。不要在 Seek 內嵌完整雙欄瀏覽器。
