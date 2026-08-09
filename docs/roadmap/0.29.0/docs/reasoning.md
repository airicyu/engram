# 0.29.0 — Reasoning

← [INDEX](../INDEX.md)

做什麼以 INDEX／[capture-and-appendix](./capture-and-appendix.md) 為準。本檔只留 **為何**；若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 為何本版只做附圖

0.28 把 node 主檔與 vault／wikilink 地基打好，但 capture 仍是純文字。附圖是下一條「Obsidian 相容記憶」缺口，且與 graph／vector／反思補問正交。單版單主題，避免範圍膨脹。

---

## 為何 tmp＋最終 path 預寫正文

失敗模式：submit 才改正文裡的 path → 前端易漏改、校驗複雜。

作法：實體先落 tmp，但 embed **一開始就寫最終 path**；submit 只 move。未提交的檔靠 housekeep 清 tmp（預設 2 天）。

---

## 為何 appendix 用標題區塊、不用 nested fence／YAML 當 raw 主格式

- Nested ` ``` ` 包 relationship：使用者或外層 md 一包就碎。
- 整段 YAML：relationship 多語言／標點易弄破；與 Engram「Structure notes／report 小標」文化不一致。
- 標題區塊：固定 `##`／`###`／`**name:**`／`**relationship:**`，好教 AI、人在 STM 也掃得懂。
- 機器校驗另走 `event.attachments[]`；appendix 由 JSON **渲染**，避免反向脆解析當唯一真相。

---

## 為何不依賴 vision

Runner 可能是不能讀圖的模型。選材必須能在 **純文字**（raw＋relationship）下完成。Vision 當日後加分，不當本版管線前提。

---

## 為何不做 WYSIWYG

目標是「拖／貼進寫作表面＋行內 embed 占位」，不是筆記 App。Textarea＋media attachments 列表在工程成本與心智上足夠承載 relationship 必填；完整區塊編輯器另案。

---

## 為何對稱校驗（正文集合＝attachments 集合）

防：上傳了圖、列表有項，但正文從未引用 → 孤立檔＋AI 難掛點。  
逆命題（正文有 embed、列表無）一併拒，避免人手改字導致 submit 時 path 無 relationship。

未來「reuse 既有正式附件」仍應進 media attachments 列表，對稱規則可延續。

---

## 為何不抬 boot 門檻、無 migrate hop

`_attachments/` 與可選 `attachments[]` 皆 **additive**；舊庫無目錄、舊 event 無欄位仍合法。首次上傳 ensure 即可。避免為空目錄逼所有人跑 hop。

---

## 為何不強制機械写入 day ledger embed

討論曾提「ledger 當證據通道、server 強制挂」。本版選擇 **prompt＋AI 選材**，範圍較小、與「rollup 可取捨」一致。若日後發現 AI 常漏挂導致 Obsidian 日層看不到圖，再另版加機械保証——不在 0.29 偷做。

---

## 為何 tmp 不進 git（P2＝A）

未 submit 的草稿圖不應進記憶庫歷史。Ensure 目錄時自動寫 ignore，避免「追蹤 memories/**」把 tmp 吃進去。正式 `uploads/{日}/` 仍追蹤。

---

## 為何每則張數不限、只限單檔大小

張數上限對「一天多圖敘事」不自然；真正成本在單檔 bytes 與 git。預設 10MiB 可配置；不做 HEIC 以免轉檔／相容坑。

---

## 為何 submit 失敗要盡力搬回 tmp（F1）

Move 已成功、L0／STM 寫入失敗時，若檔留在正式目錄，會出現「有圖無 event」、對稱與 Obsidian 難對帳。Best-effort 搬回 tmp 恢復 compose 可重試狀態；搬回失敗只 log、不發明補償 API——避免半套事務產品化。

---

## 為何對稱只認精確 `![[path]]`（F3）

機器寫入與校驗同一形狀，避免 `|alias`／空白變體導致「以為引用了、集合對不上」。人在 Obsidian 手改別名是另日問題；Engram submit 路徑保持嚴格。

---

## 為何 activities 不 git commit（F5）

對齊現行：記憶庫 commit 掛在 dream approve 等既有路徑。每則 capture 都 commit 會噪音化歷史，且與現況不一致。

---

## 否決過的方向（摘要）

| 方向 | 為何不選（本版） |
|------|------------------|
| 只 L0 留圖、chain 永不 embed | 削弱「vault 打開就看到圖」 |
| 無 relationship、靠 vision | 異質 model 會盲編排 |
| Client 組 appendix 當唯一真相 | 易伪造／漏挂；與雙軌不符 |
| 完整 md WYSIWYG | 過重 |
| 本版順便做 graph／reuse 庫 | 範圍膨脹 |
