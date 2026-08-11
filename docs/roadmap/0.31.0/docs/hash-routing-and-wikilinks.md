# 0.31 — Hash 路由與 MdBlock wikilink

← [INDEX](../INDEX.md)

做什麼以 INDEX 已定案 A／B 為準；本檔寫 **HOW**（path 表、preprocess、點擊）。

---

## 1. Hash 形狀

| Hash | UI |
|------|-----|
| `#/activities` | Activities |
| `#/consolidate` | Consolidate |
| `#/clarify` | Clarify |
| `#/seek` | Seek |
| `#/memory` | Memory；**固定 chain mode**（不記上次 nodes／chain） |
| `#/memory/chain/{level}/{id}` | Memory → chain；`level`＝`day`｜`week`｜`month`｜`year`；選中該 id |
| `#/memory/nodes/{id}` | Memory → nodes；選中該 node |

- `{id}`：`decodeURIComponent`；寫入時對非 `[A-Za-z0-9._-]` 做 encode。
- 多餘 segment／未知 level：落到 `#/memory`（chain mode），**不**整頁錯誤頁。
- Query string（`?`）本版忽略。
- **空 hash：** 顯示 activities；**不**在進站時自動寫入 `#/activities`（懶寫）。第一次使用者導航後才有 hash。

### 同步規則

1. **讀：** `hashchange`＋首次 mount 解析 → `setScene`／Memory 內部 state。
2. **寫（history API）：**
   - **場景 tab**（含進入 `#/memory`／`#/memory/nodes/…` 等跨場景）→ **`history.pushState`**（或設 hash 且進入歷史堆疊），讓瀏覽器「上一頁」可回到上一場景。
   - **Memory 同 mode 內換選中項**（換另一個 day id／node id）→ **`history.replaceState`**，只改現行條目、不堆疊，避免連點列表把上一頁變成「上一個 node」。
3. Memory 尚未載入 index 時先套用 hash 的 id；index 回傳後若 id 不在列表，維持選中 id 並顯示既有「讀取失敗／空」文案（與今日行為對齊）。

### `pushState`／`replaceState` 在本產品的意思

瀏覽器有一疊「你去過的網址」。改 hash 時可以：

| API | 比喻 | 按「上一頁」 |
|-----|------|----------------|
| **pushState** | 在疊上**再放一張**新網址 | 回到改之前那張（例如上一場景） |
| **replaceState** | **換掉最上面那張**，疊的高度不變 | 不會一步步退回剛點過的每個 node |

兩者網址列看起來都一樣會變；差在「上一頁」好不好用。

---

## 2. Preprocess（餵 markdown 前）

建議純函式（web）：

```ts
preprocessNodeWikilinks(md: string, knownNodeIds?: ReadonlySet<string>): string
```

### 轉換表

| 輸入 | 輸出 |
|------|------|
| `[[nodes/{id}/{id}\|label]]` | `[label](#/memory/nodes/{encId})` |
| `[[nodes/{id}/{id}]]` | `[{id}](#/memory/nodes/{encId})` |
| `[[{id}\|label]]` 且無 `/`，且 `knownNodeIds` 有 `id` | `[label](#/memory/nodes/{encId})` |
| `[[{id}]]` 同上 | `[{id}](#/memory/nodes/{encId})` |

`{id}` 與 path 兩段必須相等才認 P1（與 `structure-notes.ts` 的 `NODE_WIKILINK_RE` 對齊）。

### 明確不碰

- 已是標準 markdown link 的 `[…](…)`
- `![[…]]`（整段留给後續／原樣；**不要**用只匹配 `[[` 的正則誤傷 embed）
- `[[nodes/foo/bar]]` 且 `foo≠bar`
- `[[nodes]]`（短連 id＝`nodes`）：僅當 known 集合真有 id `nodes` 才轉，否則原樣

### `knownNodeIds`

- Memory node 詳情：傳入當下 index 的全部 id（或至少 list 載入結果）。
- Consolidate report：可傳空 Set → **只轉 P1 path 形態**，短連不轉（report 裡少見短連）。
- 若未傳：等同只啟用 P1 path 兩形態。

---

## 3. MdBlock 接入

`MdBlock` 增加可選 prop：`knownNodeIds?: ReadonlySet<string> | string[]`。

流程：`body` → `preprocessNodeWikilinks` → `ReactMarkdown`。

點擊：`#/memory/nodes/…` 由 Track A 的 hash listener 處理；**不必**在 `MdBlock` 內 `preventDefault` 自幹導航（除非發現 markdown 把 hash link 弄壞再補）。

---

## 4. 與附件預覽

本版 **不**要求在 Memory 內把 `![[_attachments/…]]` 渲染成 `<img>`（可另版）。Preprocess **不得**破壞這類字串。

---

## 5. 測試建議

- 單元：P1 有／無 label、短連 known／unknown、`![[_attachments/x]]` 不變、不對稱 path 不變
- 手測：開 engram node Relation 點 `eric` → URL 變 `#/memory/nodes/eric` 且右側為 eric
