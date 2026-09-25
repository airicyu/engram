# 0.6.1 — `@` 新建節點意圖（node-create）

← [GUIDELINES](../GUIDELINES.md) · 上游：[0.6.0](../0.6.0/INDEX.md) · [changelog](../../../changelog.md) · [version](../../../version.md)

**狀態：** `shipped`

> **產品句：** 事件輸入 `@` 一個尚不存在的節點時，可明確標成「新建」；沉澱入夢時 **必須** 為這些意圖建立 node 主檔（對齊完整 Engram 0.32，Lite 無 dream staging）。

## 已定案

| # | 題 | 定案 |
|---|----|------|
| 1 | 既有提及 | 繼續插入 Obsidian wikilink：`[[nodes/{id}/{id}\|title]]` |
| 2 | 新建意圖 | raw 內嵌 `[@label](node-create:{id})`（與 Engram 同形）；**禁止**用假 wikilink 假裝已有檔 |
| 3 | Composer | `@query` 可 sanitize 成合法 id 且 live 尚無該 id → 下拉出現「新建：{id}」；選後插 create chip |
| 4 | 阻擋 | create 目標若 live 已有 → UI 不提供新建列；`POST /events` → **400** `mention_create_exists` |
| 5 | 非法 id | 形似 `[@…](node-create:…)` 但 id 非法 → **400** `invalid_mention_id` |
| 6 | Distill | 本批 pending 的每個 create id：**必須**寫 `memories/nodes/{id}/{id}.md`（可骨架）；chain 第一次提及用 P1 wikilink；不得以「瑣事不開 node」略過 |
| 7 | 語意邊界 | Server **只**機械校驗 token／存在性；**不**決定節點怎麼寫——文體仍在 skill |

## 非目標

- 還原 Engram `[@…](node:id)` 作為 ref（Lite ref 維持 wikilink）
- Dream staging／approve／Structure notes 閘門
- 把裸 `@文字`（未確認成 chip）自動升級成 create
- Clarify／Seek 輸入框共用 mention composer
- Distill 自動維護 `activity_score`

## 驗收

- [x] `@不存在名` 下拉可選「新建」並插入 create chip；發帖後 `pending.jsonl` 的 `raw` 含 `[@…](node-create:…)`
- [x] `@已存在` 只出現 ref（wikilink），不出現同 id 的新建列
- [x] `POST /events` 對 create→已存在／非法 id 回 400
- [x] `engram-lite-distill` SKILL／data-spec 寫明 create **必須**建檔
- [x] `bun test` 通過（含 mentions 單元測＋ shell 字串契約）

## 錨點檔案

`web/mention-composer.js`、`web/app.js`、`web/i18n.js`、`web/style.css`、`server/nodes/mentions.ts`、`server/index.ts`、`.agents/skills/engram-lite-distill/SKILL.md`、`docs/data-spec.md`、`docs/api.md`
