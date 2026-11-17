# Future-sight：到期要改寫

**狀態：** 構想。尚未排進版本。

## 題意

`GET /future-sight` 會把過了 `anchor_end` 的條目標成 expire，但 `upcoming.md`／`longTerm.md` 本身可以停在舊的 `updated_at`，過期條目仍以未來式躺在原區。日期型承諾（某日某場、某次預約）與開放式意圖（一段期間內想做到的事）寫在同一種條目裡。前者過期後仍像未發生；後者則不該因為窗口到了就被當成失敗。

要做成：

- 下一次 distill **改寫檔案**，不是只在 HTTP 讀取時標 expire。每條 `anchor_end` 早於當地今天的條目必須變成三者之一：已發生（寫明落在哪一天或哪篇鏈，然後自 zone 移除或標 closed）、改期（新的 `anchor_start`／`anchor_end`）、放棄（短句原因後移除）。三選一都要留下可讀的一句，不要默默刪掉而不說。
- 條目種類分開：`dated`（有必須發生的那一天或那一窗）與 `intent`（開放式，窗口結束代表該重新確認，不代表做完或失敗）。`dated` 過期未改寫＝這次 distill 未完成。`intent` 過期則改寫成「要不要續期」，不要自動標成已完成。
- 精確的聯絡細節（電話、診間、地址）留在條目裡只能當提醒；一旦 closed，不要複製進 node 的 Standing facts，除非使用者事件裡本來就寫了。

## 可能要定（排進版本時寫進 INDEX）

- 種類欄位放每條的 yaml 區塊（`kind: dated | intent`）。舊條目沒有 `kind` 時，distill 依有沒有單日 `anchor_end == anchor_start` 暫代，並在改寫時補上欄位。
- Closed 的句子留在 zone 檔底部一個 `## Closed` 直到下一次改寫清掉，還是只寫進當日 day chain。建議只進 day（若該天有在寫）並自 zone 刪條目，避免 zone 變成第二本日記。
- 沒有 pending 事件時，排程 distill 仍要跑這一段改寫。這是控制面順序，判斷「發生了沒有」仍在 skill：沒有證據就標成待確認，不要編成已發生。

## 不要當成題目的一部分

- 只改 `GET /future-sight` 的 expire 旗標而不改檔
- Server 用日期比較之外的規則決定「這件事算不算發生」
- 把 zone 檔裡的精確個人聯絡資料複製進 demo 或 roadmap 例證
