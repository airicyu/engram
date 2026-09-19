# 0.1.0 — Skills 寫檔的個人記憶

← [changelog](../../../changelog.md) · current: [version.md](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**（2026-09-16）  
> 追溯基線：本版描述 Lite 在加上 `memories/` vault 之前的產品形狀。後續路徑以 [0.2.0](../0.2.0/INDEX.md) 為準。

## 產品句

個人記憶以 **pi-agent skills 寫檔** 為主；可選 Bun server／UI 只讀寫 pool 並背景派 distill／ask。沒有 dream staging、approve、store git、clarify。

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 主體 | ingest／distill／ask 是 skill；server 不實作寫作規則引擎 |
| 2 | 事件 | `{store}/pool/pending.jsonl` 一行一 JSON：`id`、`ts`、`raw`、可選 `note`。UI `POST /events` 機械一筆、現在時間、不拆、不寫 note |
| 3 | Chain | 日／週／月／年各一 markdown；第一行 `##` 題材；週月年有升層閘門；禁止合訂本 |
| 4 | Nodes | `{store}/nodes/{id}/{id}.md`；wikilink `[[nodes/{id}/{id}\|顯示名]]` |
| 5 | Ask | 只讀 chain＋pending；不讀 archived／nodes |
| 6 | Job | `POST /distill`／`/ask` 回 202；`{store}/jobs/{id}.json`；同時一場 Pi |
| 7 | 憑證 | 不讀 lite `.env`；Pi 用本機 `~/.pi/agent/` 或既有 API key env |

## 非目標

- Engram dream／approve／git／clarify／future-sight
- activities 與 short-term 雙軌
- 圖像上傳

## 驗收

- [x] 倉庫根 `pi` 可跑三個寫作 skill 與 reset
- [x] `bun test` 涵蓋路徑與 demo pool
- [x] `docs/data-spec.md`、`docs/api.md` 描述當時契約（其後 0.2.0 改路徑）

## 錨點

`.agents/skills/`、`server/index.ts`、`docs/data-spec.md`。

← [0.2.0](../0.2.0/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
