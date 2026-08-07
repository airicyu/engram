# Node standing understanding（0.25 契約細節）

← [INDEX](../INDEX.md)

本檔是 **HOW**：檔內形狀與 dream 寫入規則。範圍與定案以 INDEX 為準。

## 路徑與 API

| 項目 | 值 |
|------|-----|
| Store 檔 | `memories/nodes/{id}/understand/what.md` |
| 讀取 | 整檔＝最新理解（0.16+；無 Current／History） |
| API 欄位 | 0.25 仍為 `what_current`（本版不改名）＝上述整檔字串；**0.26+** 改為 `understanding`（見 [0.26.0](../../0.26.0/INDEX.md)） |

## 檔內骨架（強制期望）

Agent 寫入的 `what.md` **必須**含以下四個二級標題，**順序與拼字固定**（英文）：

```markdown
## Identity

（定義：是誰／是什麼）

## Relation

（與使用者的關係；不適用則 `_None_`）

## Standing facts

（穩定事實）

## Current situation

（當前狀態濃縮；或 `_None_`）
```

### 空段

四段標題**皆須出現**。某段暫無內容時，該節正文為：

```markdown
## Relation

_None_
```

### 語言

正文語言遵循既有 `memory_language`／`{{MEMORY_LANGUAGE}}`。**標題**維持上列英文（便於機械 assert 與跨語言一致）。

### 與 kind

不另建檔。Prompt 可提示：

- `person`：Identity＋Relation 通常有內容
- `project`／`theme`／`org`：Identity＋Standing facts 為主；Relation 常 `_None_`

## Dream 寫入規則（實作須寫進 `dream-files.md`）

1. **可寫路徑不變**：node 敘事仍只透過 draft 更新 `nodes/*/understand/what.md`（外加既有 chain／future-sight 規則）。
2. **整檔 rewrite**：每次更新該 node 的 understanding，寫出完整四段檔，不要只 append 新段落到舊日記尾。
3. **禁止**：以 `YYYY-MM-DD：做了什麼` 列表作為 `what.md` 主幹（那是 chain 的事）。
4. **本輪事件**：ledger／day summary 寫情節；node 只寫沉澱後的事實或狀態句。
5. **新建 node**：同時建立的 `what.md` 即為四段骨架（可多數 `_None_`，Identity 至少有一句非 `_None_` 的定義為佳）。
6. **Report**：`### Long-term updates` 寫「對哪些 node 的理解改了什麼」，勿貼事件複本。
7. **讀到日記式舊檔**：改寫為四段 standing model，把仍有效的穩定資訊升到 Identity／Relation／Standing facts；情節細節留給 chain（本輪若有對應 day 可寫進 summary／ledger，若無則不要為了「搬日記」憑空造 day）。

## 與 chain／future-sight

| 內容 | 去處 |
|------|------|
| 「Nara 是同事、職稱…」（虛構） | node Standing／Identity／Relation |
| 「2026-03-12 快測陽性」（虛構單日事件） | chain day |
| 「2026-11 去北灣拍照」近程錨（虛構） | future-sight（若符合既有規則）＋必要時 Current situation 一句濃縮 |

## 驗收用字串（測試可 assert）

檔案中應能找到（順序出現）：

1. `## Identity`
2. `## Relation`
3. `## Standing facts`
4. `## Current situation`
