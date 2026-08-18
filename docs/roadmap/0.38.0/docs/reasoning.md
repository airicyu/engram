# 0.38 reasoning — 為何改寫作契約、不改格式

← [INDEX](../INDEX.md) · 契約細節：[chain-prose.md](./chain-prose.md)

做什麼以 INDEX 為準。本檔只留動機、反例、否決過的方案。若要改已定案，先回答：下列失敗模式是否仍成立。

---

## 人實際讀到什麼

在寫作契約未改的前提下，日／週／月摘要常呈現：日層單標題＋單段牆；週層分題對了，節內仍把整週焊一段；月層像兩週合訂。過程旁白（如 `Reading the write context…`）也曾漏進正文。這不是「模型偶發」，而是指令允許甚至鼓勵的形狀。具體好／壞例只用虛構情節，見 [chain-prose](./chain-prose.md)。

---

## 現行 prompt 為何會產出打包文

週 writer 同時要求：

1. 按生活線分 `##`（對的）
2. **每節一個短段（必要時兩段）**
3. **fuse related beats into flowing prose**
4. **Preserve any `[[nodes/…]]` already present in `lower[]`**

(2)(3) 把「融合」理解成單段密寫；(4) 把省略變成違約——下層每句 link 都得找地方掛，細節就被拖上樓。月／年的「concise／trust summary judgment」敵不過這三條更硬的句子。

Day 的 `summary` 欄寫「fused full-day narrative」＋「prefer `##` when distinct threads」，沒有禁止併題、沒有要求線內可分段，模型就用一個頭條包整天。

---

## 為何只改 prompt＋mock＋一點 lint

失敗在**寫手任務**，不在 JSON schema、不在 GET 預覽 80 字、不在 UI 列表。改 API 或加「文風分數」不能讓下一輪 dream 寫出不同的段。Prompt 是唯一每輪都會被讀的契約；mock／phases 防止回歸成 paste；過程句可用機械針抓住（已發生過一次）。

**否決：用字數／段數硬失敗 dream。** 「好文章」沒有穩定閾值；薄的一天本來就短；體檢／預約那天合法地需要鐘點。硬閘門會逼模型刪錯東西或灌水分段。過擠留給人 amend。

**否決：store migrate／全庫重寫舊 summary。** 舊文是已批准記憶；自動重寫會改人已接受的語氣與取捨。新契約只管新產出；既有 revise＝整篇替換，只在該週／月真的再被 rollup 時發生。要立刻改某一篇用 amend。

**否決：改 ledger 為文章。** Ledger 的工作是增量、可對 event id；summary 才是給人掃讀的敘事。把兩軌都文章化會重複，且破壞 append-only 的碎片本質。

---

## 為何收窄 wikilink 密度、不廢 0.31

0.31 要的是時間軸上**抽得到邊**、Obsidian 可點。0.37 graph **不算** chain 正文當邊（只算 node 主檔 P1），所以 chain 上每個主語都掛 link 對圖沒有額外好處，卻會打斷閱讀。

節內**首次** P1 仍滿足：該節提到該 node 時檔內至少有一個機器可辨 link；search／Obsidian 仍找得到。同節後文口語名是給人讀的。

**推翻「保留 lower 全部 link」** 是取捨能成立的前提：否則 writer 無法丢掉一拍。這不是廢互指，是禁止「為 link 而抄細節」。

---

## 為何日允許碎、週以上必須取捨

日的材料經常真的不相干（發版與一頓晚飯同一天）。強迫寫成一篇短篇會假。誠實寫法是多則短記。

週／月／年若仍逐拍複述，三層讀感趨同，只是字數變長——失去做更高層的理由。層存在的意義是**判斷**：什麼定義了這段時間。判斷必然包含省略。

---

## 過程句為何值得 lint、其他文風為何不 lint

「Reading the write context…」是工具殘渣，正則穩定、與內容無關、已在 prompt 禁止卻漏過。適合 Structure notes。

「這段夠不夠文章化」沒有穩定正則，硬做會誤傷專名密度高的合法日文（預約鐘點、發版號）。不在本版自動判。
