# 0.37.0 — 節點圖 API 與 UI（HOW）

做什麼以 [INDEX](../INDEX.md) 為準。本檔只寫 `GET /memories/nodes/graph` 與節點模式畫面怎麼用這份資料。

## `GET /memories/nodes/graph`

- **唯讀**。無 request body、**無 query**。未知 query → 與其他嚴格 GET 一樣 **400**（若該路由已有「多餘欄位／query」慣例則跟現有 nodes index 一致：現況 index 無 query 時多餘 query 行為跟 `GET /memories/nodes` 同一個 helper）。
- **不**寫磁碟；每次掃描 live `memories/nodes/{id}/{id}.md`。
- **不**掃 `memories/chain/**`、STM、activities。

### 200 body

```json
{
  "present": true,
  "nodes": [
    { "node": "acme", "preview": "…", "score": 180, "display_score": 100 }
  ],
  "edges": [
    { "a": "acme", "b": "engram", "refs": 3, "level": 2 }
  ]
}
```

| 欄 | 規則 |
|----|------|
| `present` | 至少一顆 **存在的** L2 node（有 `{id}/{id}.md`）→ `true`；否則 `false`。 |
| `nodes` | 與 `GET /memories/nodes` **同一集合、同一欄位語意**（`node`、`preview`、`score`、`display_score`）。排序：`node` 字串升序。不存在的 id **不出現**。 |
| `edges` | 無向。`a`、`b` 皆為存在的 node id，且 `a < b`（字串升序）以免重複。`refs` 正整數 ≥1。`level` 整數 1–10。無邊 → `[]`（即使 `present: true`）。 |

空庫／無任何 node 檔：

```json
{ "present": false, "nodes": [], "edges": [] }
```

**不要 404。**

`GET /memories/nodes` 與本端點的 `nodes[]` 必須一致（同一 store 同一時刻）；phases 可對兩個 GET 比對 id 集合。

---

## 引用計數（`refs`）

只掃 `memories/nodes/{id}/{id}.md` **全文**（即 standing understanding 整檔）。

P1 形與 0.31 相同：`[[nodes/{other}/{other}|顯示文字]]`（顯示文字可空／可有）。同一檔對同一 `other` 出現 n 次計 n。

忽略：

- 非法 id
- 指向自己（`other === id`）
- 指向 **沒有** live `{other}/{other}.md` 的 id（不進 `nodes[]`、也不進邊）

```
count(A→B) = A 的 md 裡 P1 指向 B 的次數
refs(A,B) = count(A→B) + count(B→A)
```

僅當 `refs >= 1` 輸出一條邊。

---

## `level`

對 `refs >= 1`：

```
level = min(10, max(1, ceil(log2(refs))))
```

`log2` 以 2 為底。`ceil(log2(1)) = 0` → clamp 後 **1**。

| refs | level |
|------|-------|
| 1 | 1 |
| 2 | 1 |
| 3–4 | 2 |
| 5–8 | 3 |
| … | … |
| ≥ 2^10 | 10 |

UI：level 1 線最淡、10 最深（同一色相即可）。

---

## 節點模式 UI

1. 載入 graph GET（可與既有 nodes index 二選一當點資料；**邊必須**用 graph GET。為免兩份不一致，**點與邊都用 graph GET**）。
2. 佈局：force-directed 2D；可縮放；可拖單一 node。
3. 半徑（或面積）∝ `display_score`；`null` → 最小可見點（仍可點）。
4. 篩選：沿用 `MemoryScene` 對 `node`＋`preview` 的 substring。命中 highlight；其餘降低 opacity，**不要 unmount**。點 dim 的點仍開 detail。
5. 選中：右側（或現有 detail 欄）顯示 `GET /memories/nodes/{id}`；同步 hash。
6. 零 node：與現況節點空態同等文案（不要空白死圖當錯誤）。

記憶鏈模式 **不**呼叫 graph GET。
