# 0.7.0 HOW

## 誰做判斷、誰做機械改寫

`engram-node` 只在使用者已說出從檔 id 與主檔 id（或要刪的 id）時動手。把四節正文收進主檔、去掉重複句子，是 skill 的寫作。掃檔與替換 wikilink 是腳本：skill 必須呼叫它，不得只在回覆裡宣稱已改完。

腳本輸入（隔離 store 路徑＋模式）：

- `merge --from {id} --into {id}`：把 `[[nodes/{from}/{from}|顯示名]]` 換成 `[[nodes/{into}/{into}|顯示名]]`（顯示名逐字保留）；無 pipe 的 `[[nodes/{from}/{from}]]` 換成 `[[nodes/{into}/{into}]]`。不刪 node 檔。Skill 寫完主檔四節後自行刪從檔目錄。
- `delete --id {id}`：有 pipe 的連結換成純文字顯示名；無 pipe 的換成 id 文字。然後刪除 `memories/nodes/{id}/`。

`pending.jsonl` 只在該行字串內替換上述連結。替換後該行仍是一筆合法 JSON，其他欄位不變。掃描路徑只限 INDEX 已定案 #5。`clarify/` 與 `archived.jsonl` 不在清單內。

## Distill

讀取既有 `aliases` 與 H1 是 skill 步驟，不是 server。本次鏈上用的顯示名若不在 `aliases`，寫回主檔。

空殼刪除呼叫同一個 `delete` 腳本（改純文字並刪目錄），避免死鏈。只針對本批開始前就存在、且兩節事實區仍空或只有佔位、這次仍寫不出事實的 id。本批 `[@…](node-create:{id})` 新建的骨架同一輪必須留下，即使事實區仍空。

## Ask

比對鍵只有 id、frontmatter `aliases`、以及該檔第一個 H1。不為了比對而讀 Standing facts 等正文。唯一命中才讀全文。多於一個主檔命中時列出 id 並詢問，不併讀。零命中則回答 chain／pending／future-sight，並寫一句沒有對上的節點。
