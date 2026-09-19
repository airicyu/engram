# 0.3.0 HOW

契約細節。產品範圍以 [INDEX](../INDEX.md) 為準。

## Skills vs HTTP

| 動作 | 誰 |
|------|----|
| 拆筆、寫 `note`、寫 chain／nodes、出釐清題、消化 pending 釐清、day 插入 embed | **skill**（Pi） |
| append 一筆 events、存圖 bytes、submit／dismiss／aside 釐清檔、search、graph、讀 markdown | **server** 機械 |
| distill／ask | server **只** 202＋job，prompt 仍叫現有 skill |

`engram-lite-ask` 本版可讀 search 不代替：Ask 仍只讀 chain＋pending（INDEX：不讀 clarify）。UI 搜尋走 GET／search。

## 搜尋

掃描根：`memoriesDir()`。文字檔用 UTF-8。每命中 `path` 用 POSIX 相對 `memories/`。`snippet`：命中前後各約 40 字，單行。

## 釐清檔例（虛構）

`memories/clarify/asking/cla_20260920_ab12cd.md`：

```markdown
---
id: cla_20260920_ab12cd
ts: 2026-09-20T22:00:00+08:00
---

與 Acme 的會議，對方答應的配額數字是多少？
```

Submit 後同一檔到 `pending/`，並在正文末加：

```markdown
## Answer

（人寫的 answer）
```

Aside 無 Question 段，frontmatter 加 `kind: aside`。

Distill 移 history 時可在 frontmatter 加 `absorbed_at`，**不要**改 chain 文體規則。

GET：`/clarify/asking`、`/clarify/pending` 回 `{ items: [{ id, ts, markdown }] }`，新→舊。

## 附圖

與 INDEX 已定案 8–11。校驗 embed：正則精確 `![[_attachments/uploads/YYYY-MM-DD/filename]]`，filename 單一段。

`appendPending` 擴成可收 `attachments?`。jsonl 多可選鍵：

```json
{
  "id": "evt_20260920_aaaaaa",
  "ts": "2026-09-20T22:10:00+08:00",
  "raw": "午餐\n\n![[_attachments/uploads/2026-09-20/menu.png]]",
  "attachments": [{ "path": "_attachments/uploads/2026-09-20/menu.png", "relationship": "當日菜單" }]
}
```

無圖事件不得出現 `attachments` 鍵，或允許省略。

## 圖

建圖時忽略指向不存在 id 的 wikilink。`title`＝node 檔第一個 `# ` 標題，否則 id。

## UI hash

| Hash | 頁 |
|------|----|
| `#/events` 或空 | 記入＋pending／archived 列表 |
| `#/seek` | 搜尋＋提問＋近期 ask |
| `#/clarify` | asking 列表、作答、aside |
| `#/memory` | 預設 chain；`#/memory/nodes` 列表；`#/memory/graph` 圖 |

不必實作 Engram 的 `#/consolidate`、`#/dream-reports`。
