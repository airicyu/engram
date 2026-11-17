# 0.7.0 WHY

短指針（`merged_into`）被否決：合併與刪除都要改連結，留一個空檔只為了轉址會讓節點層繼續堆殼。直接改寫後，舊 id 放進主檔 `aliases`，Ask 與 distill 仍對得上。

改寫做成腳本：範圍固定、顯示名不可改，適合測試。哪兩份是同一實體仍由使用者指名，skill 不聚類，server 不比對名字。

UI 不接：Lite 的寫檔主體是 pi-agent skill。合併不是讀檔或派工按鈕。

`archived.jsonl` 不改：Ask 不讀它，改寫歸檔會把已沉澱列再當成現行連結。`clarify/` 不改：題目不是長期 wikilink 來源，吸收時 distill 會依別名寫進主檔。
