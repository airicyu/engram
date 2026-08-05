# 0.22.0 — 一鍵 dev（API + UI）

← [changelog](../../../changelog.md) · 上游：[0.21.0](../0.21.0/INDEX.md)（shipped）· current: [version](../../../version.md) `0.22.0` · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**（2026-08-05）  
> 根目錄單一 `bun run dev` 並行啟動 server + web；分開啟動改走 `dev:server`／`dev:ui`。

## 產品句

> 開發者在倉庫根目錄執行一次 `bun run dev`，即可同時跑 API 與 workbench UI；終端 log 可辨識來源，結束行為可預期。

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | `dev` 語意 | **兩邊一起**；僅 API 用 `dev:server` |
| 2 | Log | 每行前綴彩色 `[server]`／`[web]` |
| 3 | 子行程掛掉 | 整個 `dev` 結束，exit code 取自先掛的那方（缺則非零） |
| 4 | Ctrl+C | 兩邊 process tree 一併 TERM→KILL |
| 5 | Store | 不 bump `store_version`；無 API／記憶契約變更 |

## 非目標

- 新依賴（不用 concurrently 等）
- 改 server／web 各自 `scripts/dev.sh` 行為
- OS 級 process manager／tmux

## 驗收

- [x] `bun run dev` 同時 listen `:8787` 與 `:8788`；輸出含 `[server]`／`[web]`
- [x] `bun run dev:server`／`bun run dev:ui` 仍可單獨啟動
- [x] Ctrl+C 後兩埠皆釋放
- [x] README／AGENTS.md／changelog／version 已更新

## 錨點

- `scripts/dev.sh` — 並行＋前綴＋shutdown
- `package.json` — `dev`／`dev:server`／`dev:ui`
