# 0.5.0 reasoning

← [INDEX](../INDEX.md)

## 為何 vault 只存 wikilink embed

- Obsidian 開 `{store}/memories/` 時，`![[_attachments/uploads/日/檔]]` 與 Engram 一致，無需 HTTP。
- Engram UI 的 `/api/attachments/file` 是**讀時**轉換；持久化 URL 會讓 Obsidian 與 Lite 分叉。
- Import 與 distill 責任是**正規化** Engram 已烘焙的 markdown 圖片回 wikilink。

## 為何仍不引入 React

0.3.0 已定案靜態殼；還原是 CSS + 行為對齊，不是搬 `web/src` 建置鏈。

## 活躍分另列 backlog

Engram `display_score` 依賴 consolidate／涉入模型；Lite 無對應 store 欄位前，UI 還原假分數會誤導。
