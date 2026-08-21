# 0.42.0 reasoning

做什麼以 [INDEX](../INDEX.md) 為準。本檔只留動機與反例。若要改已定案，須先能回答：原本要防的失敗模式是否仍成立。

## 為何掛「近期輸入內容」而不是提問郵箱

提問郵箱的工作是**未答的題**（asking）。答完若仍留在郵箱，會變成第二個歷史匣，和「進來一則、答完或略過就離開」的 DM 模型衝突。

事件頁近期 tab 已是「還沒進長期記憶層的輸入」：STM pool 等下一場夢。pending 釐清同一語意，只是來源不是 L0。掛在同一 tab、分成兩區，人能對齊「這些都會等入夢」。

否決：第五左欄（IA 已四項）；郵箱加「已答」tab（0.30 不做 history GET 的產品理由仍在——history 是蒸餾後歸檔，不是「等入夢」）。

## 為何必須含 aside

Aside 與 submit 一樣進 `pending/`、一樣進 distill。若區（2）只列 prompt，順帶補充會從郵箱消失且近期也沒有，缺口與本版要修的相同。

Dismiss 不進 pending，列入區（2）會假裝「還會入夢」。

## 為何新 GET，而不是 UI 讀檔或複用 asking

操作邊界：工作台只打 HTTP。0.30 故意不暴露 pending list，當時沒有「等入夢的輸入牆」。讀 asking 看不到已答。故加唯讀 GET；不開 history GET（那是已沉澱，應走 nodes／記憶頁）。

## 為何兩區不混時間軸

事件是人主動記帳；釐清是答系統問或順帶一句。混排會讓「我記了什麼」與「我答了什麼」難掃。INDEX 已定分開小標。

## 為何文案不能寫「本場夢會吃到」

0.41：開跑後才 submit／aside 的 pending **不**在本場 `clarify_snapshot`。UI 若寫「正在入夢、這些會寫進這次」，在背景夢期間答題會說謊。正確：live pending＝尚未歸檔、留給之後的夢。

## 不要改 pipeline 的 `listPendingItems` 排序

該函式給 distill／開跑快照。顯示要新→舊是 API／UI 的事。為了近期頁去改 store 預設序，會 silently 改蒸餾批次順序。
