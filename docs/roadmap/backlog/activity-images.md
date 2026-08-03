# Backlog — Activity 附圖（image／media）

← [backlog INDEX](./INDEX.md)

## 題目

支援把 **圖片** 與 activity 一併記入：上傳或 **UI drag-and-drop**，檔案複製到 store 內 **media folder**，並與 L0 event 關聯，供日後 dream／Seek 使用。

## 現況（0.20）

- `POST /activities` body 僅 `raw`（+ 可選 `source` 等）；**無** multipart／media 欄位
- Activities UI 為文字 capture；store 無約定 `memories/media/` 或 event 內 asset 引用

## 待 brainstorm（定案前）

| 面向 | 待決 |
|------|------|
| **API** | 單次 multipart（raw + files）vs 先 `POST /media` 再 activity 引用 `media_ids` |
| **儲存** | 路徑例 `memories/media/{yyyy}/{uuid}.{ext}`；是否進 git store |
| **Event 形狀** | `events.jsonl` 加 `attachments[]`（path、mime、sha256、caption？） |
| **UI** | Activities 拖放預覽、大小／格式限制 |
| **Dream／Ask** | agent 是否讀圖（vision）、或僅保留連結＋使用者 caption |
| **去重** | 同檔 hash 是否共用一實體 |

## 粗範圍（方向）

- 最小：**一圖一 event**，檔案在 media folder，event 可選 `raw` 說明
- 契約同步 `docs/api-docs/`；migrate 若動 `events.jsonl` schema 需 bump `store_version`

## 非目標（構想階段）

- 影片／大型 blob 離線同步
- 圖床 CDN
