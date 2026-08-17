# 0.35 Track B reasoning — 為何 STM 只留 pool.jsonl

做什麼以 [INDEX](../INDEX.md) Track B 為準。本檔只留動機。

## 舊設計

早期 L1 設想「今日總覽」markdown 與按 node 的 `notes.md`。0.32 之後 notes 完全由 mention 衍生；summary 只是 `formatLine` 清單，沒有濃縮。

## 為何連 summary 一併廢

- 與 `pool.jsonl` 一對一，無新資訊。
- `- [ts] (id) raw` 把欄位壓扁；之後要當 post 顯示必須再 parse，而 `raw` 可含括號與換行。
- GET 若只回 `summary` 字串，UI 無法穩定按 record 排版。
- `nodes/` 目錄名與 L2 nodes 混淆。

## 否決

| 方案 | 為何不選 |
|------|----------|
| 只刪 `nodes/`、留 `summary.md` | 仍是複本，仍阻礙按 record 排版 |
| 磁碟只留 pool、GET 仍回 `summary` | 前端仍被字串鎖死 |
| 本版做完整 post UI | 視覺未定；本版只把資料與 API 改成 record |

## 仍要防

- 不要改 pool 欄位或拿掉 mention token。
- 不要用短期 mention 當成 L2 `l1_note` 命中。
- Dream 仍須有 scope 內 `events[]`。
- 舊庫「只有 summary、pool 空」須先遷進 pool 再刪 summary。
