# 0.44 reasoning

← [INDEX](../INDEX.md)。做什麼以 INDEX／how 為準。本檔只留動機與否決案。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 為何第三 tab，而不是塞進「沉澱入夢」

沉澱 tab 的任務是 **操作這一場夢**（跑、等、改、批、丟）。Auto-approve 之後該面應回到「可以再入夢」的空閒態。若在同一面堆歷史報告，待審操作與回看會搶同一捲軸，人分不清「現在能不能批」。

失敗模式：把上一場 committed report 留在沉澱面 → 誤按 discard／approve（對已不存在的 pending）或以為還在待審。

---

## 為何只列 committed，不列 discard／reject

產品句是「看看剛沉澱進長期的是什麼」。Discard 表示 **不要** 那份理解；再展示等於把否決稿當記憶。Supersede 是被 retry 取代的舊 pending，同樣不是成功入夢。

Pending 已有 `GET /dreams/pending` 與沉澱 tab。失敗 extract 通常沒有可批的 report，列出來只會像錯誤 log。

`l1_clear_pending` 仍列：L2 已 commit，只是 STM 沒清完——報告仍是「成功那場夢」的紀錄。

---

## 為何上下主從，不要左右兩欄、不要一頁堆全部 markdown

事件欄沿用 Twitter 式窄欄（0.36）。Inbox 左右欄靠整頁 `stage-locked` 寬度；事件頁上方還有 compose，寬度不夠並排「列表＋長文」而不擠。

全部報告直向接在下面：預設 7 天可能仍有多場，每場 report 很長，無法掃「哪一場」。列表設高度上限（見 HOW：約 `min(40vh, 18rem)`），是為了 **報告正文永遠還有一塊可讀面積**；多出來的場次在列表內捲完即可，不是少列、不是分頁。`-1` 永久留檔時列表會變長，仍靠同一捲軸，本版不另做虛擬列表。

對齊 0.43 尋問 recent：先選一筆再看全文。尋問是回填表單；本 tab 是純讀，故另開 hash 深鏈（0.43 故意不做 ask hash，以免 URL 與「將要送出的題」混淆）。報告 id 穩定、唯讀，深鏈合理。

否決：入夢成功自動跳第三 tab——會打斷還想繼續記帳的人（0.41 起 extract 不擋記帳）。

否決：為本 tab 把事件欄拉成全寬——會讓三個 tab 寬度跳變，不像同一工作台。

---

## 為何要新 API，而不是 UI 掃目錄或濫用 pending

AGENTS：操作記憶狀態只打 HTTP；`dreams/` 不進 store git 但也不該讓 UI 直讀。`GET /dreams/pending` 只回 **唯一** 待審場。Cleanup 之後檔會消失，list 必須以「檔還在＋committed」為準，不能只信 yaml。

---

## 為何把區（2）單行裁切收進本版

與第三 tab 同頁（事件近期），不另開版本。人核對「已交系統、等入夢」的答若被裁成一行，產品句不成立。問句已可多行、答不行，屬呈現 bug 而非「列表預覽截斷」（預覽截斷只適用第三 tab 的 `narrative_preview`）。

