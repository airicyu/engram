# 0.33.0 — Workbench UI：釐清貼文串＋記憶鏈／節點瀏覽重排

← [changelog](../../../changelog.md) · 上游：[0.32.0](../0.32.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**  
> **本版只做這一項：** Web workbench **純 UI／版面**重構——釐清場景改貼文／留言互動；記憶鏈左欄加寬＋外層卡＋每列三內卡；節點左欄改「搜尋使用者」列；全站最大寬度與捲軸樣式統一。**不**改 HTTP API、store 契約、dream pipeline。**無** store migrate；**不**抬 boot gate。

## 產品句

> 釐清像回貼文、記憶鏈像可掃的預覽牆、節點像找人結果列——同一套工作台更易掃讀與點選，行為與 API 不變。

## 文件地圖

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、非目標、驗收（本版無另開 docs／HANDOFF） |

---

## 問題（本版要解決什麼）

1. 釐清補問一打開就是整排答題框，像問卷，降低作答意願。
2. 記憶鏈左欄過窄、單行 preview，掃讀吃力；左右欄區隔弱。
3. 節點列表像普通檔名清單，不像「找實體／找人」的結果列。
4. 全站最大寬度偏緊；部分捲軸帶系統上下箭頭，不一致。

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 範圍 | **僅** `web/` 場景 UI／CSS／i18n 殼層字串；**不**改 server／API／store |
| 2 | 釐清 | 每則 asking＝貼文列（作者 Engram、相對時間、正文、`@node` 可點）；預設不展開答題；**留言**圖示展開回覆框；送出仍 `POST …/submit` `{ answer }`；略過仍 `DELETE`；順帶補充區對齊同系發文框 |
| 3 | 釐清導語 | `clarify.lead` 含「釐清」用詞（「…以釐清理解…」） |
| 4 | 記憶鏈左欄 | 外層卡容器（捲軸在外層）；內卡加高／多行 preview；列為 **flex、每列 3 卡**；左欄約加寬；與右側 detail 拉開距離 |
| 5 | 記憶鏈右欄 | 整塊 detail（標題＋meta＋正文）＝**一張外卡**；內層 `md-block` **不再**自成白卡；底色帶紙灰，非純白 |
| 6 | 節點左欄 | 「people search」列：頭像首字、名稱、`@handle`、兩行 bio、右側活躍分；列間有間距；篩選框圓角且覆寫瀏覽器預設粗邊／怪 shadow |
| 7 | 全站寬度 | `.app` 最大寬 `80rem` → **`100rem`** |
| 8 | 捲軸 | 全站自訂細捲軸、**隱藏上下箭頭**（與記憶鏈左欄一致） |
| 9 | Topbar 順序 | **維持** activities → consolidate → clarify → seek → memory（**不**把 seek 提前） |
| 10 | Migrate | **無**；boot gate 仍 ≥0.28 |

---

## 非目標

- 任何 API／store／dream／prompt 行為變更
- 抬 boot gate、store migrate hop
- Seek／Activities 主輸入大改、Clarify／Seek 共用 composer
- 把記憶鏈左欄做成每帖頂部重複「Engram」作者列的社群風（曾試過、已捨棄）
- Graph GUI、vector、node merge

---

## 實作落點（已出貨）

| 區域 | 主要檔案 |
|------|----------|
| 釐清 | `web/src/scenes/ClarifyScene.tsx`、`web/src/i18n/{zh-Hant,en}.json`、`web/src/styles/app.css`（`.clarify-*`） |
| 記憶鏈／節點 | `web/src/scenes/MemoryScene.tsx`、同上 CSS（`.browse-layout-chain`、`.browse-index-card`、`.chain-*`／`.node-user-*`、`.browse-detail`） |
| 全站殼 | `app.css`（`.app` 寬度、全域 `::-webkit-scrollbar*`） |

---

## 驗收（已勾）

- [x] 釐清：貼文列＋留言展開作答；submit／dismiss／aside 行為與 0.30 API 一致
- [x] 記憶鏈：左外卡＋每列三內卡＋右整塊 detail 卡；預覽多行
- [x] 節點：搜尋列風格＋列間距；篩選框邊框／focus 不怪
- [x] 全站寬度與無箭頭細捲軸
- [x] Topbar 順序未改
- [x] `version.md`／`changelog.md`／AGENTS 版本脈絡＝0.33.0

---

## 與相鄰版本

| | 0.32.0 | **0.33.0** |
|--|--------|------------|
| 焦點 | Activities `@` mention＋廢 `node_refs` | Workbench **UI** 重構 |
| API／store | Breaking activities body | **不變** |
| migrate | 無 | **無** |
