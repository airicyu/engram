# 0.6.0 WHY

← [INDEX](../INDEX.md)

## 活躍分為何用 frontmatter

- Obsidian 使用者可直接在 node 主檔編輯；與 clarify／future-sight 已有 frontmatter 慣例一致。
- Lite **沒有** Engram `memories.nodes` 資料庫與 consolidate 涉入迴圈；在 distill 裡「算分」會變成第二套語意引擎，違反 AGENTS 警世原則。
- Import 時把 Engram 旁檔 `score.yaml` **機械**寫進 frontmatter，只搬快照，不承諾之後自動同步。

## 殼層為何仍用 vanilla

與 0.5.0 相同：不引入 React；狀態燈與 atmosphere 純 CSS／少量 JS 對 `GET /status` 與既有 `actionLock`。

## 真人匯入為何只寫 HOW

匯入是使用者本機操作；agent 測試只用 `scripts/fixtures/` 虛構 store。避免真人 vault 進 git。
