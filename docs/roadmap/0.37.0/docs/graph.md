# 0.37.0 — 節點圖（HOW）

做什麼以 [INDEX](../INDEX.md) 為準。

## 引用計數

只掃 `memories/nodes/{id}/{id}.md` 全文。P1 形與 0.31 相同：`[[nodes/{other}/{other}|…]]`。同一檔對同一 `other` 出現 n 次計 n。忽略非法 id、指向自己、指向不存在的 node（不存在者不進 `nodes[]` 也不進邊）。

`refs(A,B) = count(A→B) + count(B→A)`（無向邊，`a`/`b` 字串升序寫入 JSON 以免重複）。

## level

對 `refs >= 1`：

```
level = min(10, max(1, ceil(log2(refs))))
```

例：`refs=1` → `ceil(log2(1))=0` → **1**；`2` → 1；`3–4` → 2；`5–8` → 3；… 直到 10。

## Filter

篩選對 **node id 與 preview／understanding 的客戶端既有邏輯** 對齊（Memory 現在怎麼 filter 就怎麼決定命中集合）。命中＝highlight；非命中＝降低 opacity，仍可點（點了仍開 detail）。

## 空圖

零 node：`present: false` 或 `nodes: []`（與 nodes index 空態一致：200、不要 404）。
