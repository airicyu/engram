# 0.2.0 WHY

做什麼以 [INDEX](../INDEX.md) 為準。本檔只留動機與否決方案。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

## 要對齊的是 vault，不是 Engram store

完整 Engram 開 Obsidian 時 vault＝`{store}/memories/`。附圖是 `![[_attachments/uploads/{日}/{檔}]]`，chain 只重複這條字串、不複製檔。Lite 若繼續把 chain 放在 store 根，同一條 embed 在 Obsidian 開 store 根時才能解析；那與 Engram 文件、使用者直覺都分叉。

把 Lite 的 chain／nodes／pool 放進 `memories/` 之後，Obsidian 開法與 embed 字面與 Engram 相同。這是為將來捕捉相片準備，不是為了讓兩個產品共用一個目錄。

## 否決：整份複製 `engram-data`

`engram-data` 還有：day ledger＋`.summary.md`、week 檔名帶週一日期、`activities/`＋`short-term-memory/` 雙寫、`engram.workspace.yaml`＋`store_version`、store git、`dreams/`、`clarify/`、`score.yaml`。Lite 的產品句是 skills 直接寫 live 檔、無 approve。硬對齊那些目錄會逼 distill 改寫作模型，或製造 Engram 拒開／Lite 踩壞雙軌的假相容。

## 否決：jobs 進 vault

使用者曾說連 jobs 一起放進 `memory/`。Job JSON 是 server 派工狀態，對齊 Engram 的 `dreams/`：不給 Obsidian 當筆記。進 vault 只會在檔案列表裡出現一堆 `job_*.json`。

## 否決：目錄名單數 `memory/`

Engram 契約與既有 vault 都是 `memories/`。Lite 用同一個名字，以後抄 embed／開庫說明不必翻譯一層。

## 本版不做上傳

目錄先定，API 另版。否則會把 tmp、MIME、對稱校驗、appendix 一次塞進「只是搬家」的版本。Distill 也還沒收「相關就原樣帶 `![[…]]`」的教學；那應跟捕捉 API 同版或緊接其後。
