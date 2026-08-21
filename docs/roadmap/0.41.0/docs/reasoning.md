# 0.41 reasoning

做什麼以 [INDEX](../INDEX.md) 為準。本檔只留動機與反例。若要改已定案，先回答「原本要防的失敗模式是否仍成立」。

## 為何可以拿掉 extract 對 capture 的全域鎖

舊鎖同時做四件事：（1）禁第二場夢；（2）禁 extract 中 approve；（3）禁人寫 L0／釐清；（4）deploy 互斥。

(1)(2)(4) 仍要。（3）的表面上理由是「scope 會被新事件污染」。但 S 在開跑時就從 **pool 一次讀**定死；approve 只刪那些 id。這與 `pending_review` 已允許記帳、新事件不進本場 **同一語意**。讀凍結必須與寫入同一把鎖（拷貝後釋放），否則拿掉 409 後開跑讀 jsonl 可與 append 撕裂。Report 二讀 live pool 同樣。Generate asking 與人寫 pending 必須同 `withClarifyWriteLock`。

Clarify 沒有 event `scope[]`，舊管線在 **末尾** `listPendingIds()`。有全域鎖時，使用者寫不進去，末尾≈開頭。一放行寫入，末尾掃描會把本場開跑後的 aside 蒸餾進來。故釐清必須 **開頭另拍一份 scope**，不是把 uuid 塞進 event 陣列。

## 否決過的做法

| 做法 | 為何不選 |
|------|----------|
| 不鎖、讓 agent 讀 live pool，「讀到的行再標進 S」 | 工具呼叫無法可靠當契約；部分讀會漏行；雙重讀會把中途新帳捲進本場。 |
| Event 與 clarify 同一個 `scope: string[]` | id 空間不同；approve 清 pool vs 歸檔 pending 會分不清。 |
| Extract 不持 run mutex，只靠「單 pending」 | 兩場 extract 可在雙方都尚未 writeDreamRun 前並行。 |
| Extract 中 approve | Agent 還在寫 draft，deploy 半套。 |
| 只改 prompt、不改 runner 可讀範圍 | 模型仍會 `Read pool.jsonl`，draft 寫了新帳、S 沒登記 → 雙蒸餾。 |
| 清 S 不進 capture 鎖 | `persistPool` 整檔覆寫；與 append 交錯會丢掉不在 S 裡的新行。這與 LLM 無關。 |
| 多進程檔案鎖做 pool | 原型單 Bun；`withCaptureLock` 夠。 |

## 失敗模式（改契約時對照）

1. Context 二讀 live pool：快照後插入的行若混進 events[]，本場會消化不該消化的帳，或 id 不在 `scope` 卻寫進 chain。
2. Distill 末尾掃 pending：中途 aside 被本場蒸餾且 approve 歸檔，人以為「留給下一場」。
3. 清 pool 與 append 無同一鎖：STM 丟行、L0 仍在。
4. `git add -A memories` 與整檔寫 jsonl 並行：commit 到半行，之後 parse 失敗。
5. UI 仍用 `status.lock` disable 發帖：server 已放行，工作台卻鎖死——產品句不成立。
6. Ask 被誤改成不能讀 live pool：人剛記的帳立刻問不到。
