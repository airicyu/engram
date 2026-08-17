# 0.36.0 — Workbench 左欄殼＋事件 timeline＋提問郵箱 DM

← [changelog](../../../changelog.md) · 上游：[0.35.0](../0.35.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**  
> **本版：** 工作台改為左欄四項＋右欄內容。事件頁改 Twitter 式（輸入＋短期 feed＋沉澱）。提問郵箱改 DM 式。**搜索＝現有 Seek 整頁原樣**，只換掛左欄。記憶頁本版**只搬家、不改內頁**。記憶鏈／節點圖 **不排程**；0.36 出貨後再決定（草稿見 [0.37.0 parked](../0.37.0/INDEX.md)）。**不**改記憶 HTTP 契約（沿用 0.35 `entries[]`）。**有** store migrate：`0.28–0.35 → 0.36`（刪 `initialized_*.yaml`＋STM 衍生檔）；boot gate **≥ 0.36**。

## 產品句

> 人用左欄在「寫事件／搜記憶／回釐清／翻長期」之間切換；寫事件像發帖，釐清像有人私訊來問；搜索與現在一樣。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、Track、驗收 |
| 2 | [docs/ia.md](./docs/ia.md) | 左欄／hash／事件雙 tab／DM 版面 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何記憶鏈不進本版 |
| 4 | [HANDOFF.md](./HANDOFF.md) | 實作 agent 開工（含 paste prompt） |
| 5 | [docs/migrate-0.28-to-0.36.md](./docs/migrate-0.28-to-0.36.md) | 補 hop 契約（刪殘留 yaml／STM nodes） |

---

## 問題

1. 右上五個 tab 不像個人工作台，也塞不下「事件＝寫＋看近期＋入夢」一條時間線。
2. 短期已是 `entries[]`（0.35），UI 仍偏「一篇摘要」，無法當一則則帖。
3. 釐清是公開牆式帖；產品要的是「有人想來了解你」的收件箱。

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 殼 | 去掉 Topbar 橫向場景 tab。改為：**左欄垂直選單**＋**右欄內容**。品牌／locale／status-light 可留在左欄底或頂，不要另開第五個場景。 |
| 2 | 左欄四項（順序固定） | **事件**／**搜索**／**提問郵箱**／**記憶**。英文：**Events**／**Search**／**Inbox**／**Memory**。搜索**不要**再用「尋找」／Seek 當左欄名。對應 scene：`activities`＋`consolidate`、`seek`、`clarify`、`memory`（見 ia）。 |
| 3 | 場景 id／hash | **不**改 0.31 path：`#/` 或 `#/activities`、`#/consolidate`、`#/seek`、`#/clarify`、`#/memory…`。左欄「事件」在 `activities` **或** `consolidate` 時都標為選中。未知 hash 仍回事件。 |
| 4 | 搜索 | **SeekScene 內頁行為與版面等價**（Ask／Search／scope 勾選不變）。只改外殼（不再用 Topbar tab）。 |
| 5 | 記憶（本版） | MemoryScene **內頁不改**（仍 pills／列表）。只掛到左欄。 |
| 6 | 事件頁結構 | 右欄上方＝發帖區；下方兩個 **真 tab**：**近期輸入內容**（EN **Recent**）＝STM `entries[]` 逐則帖；**沉澱入夢**（EN **Consolidate**）＝現有 ConsolidateScene 能力（run／pending／approve／discard／retry／amend），改放進此 tab，不再佔左欄。 |
| 7 | 發帖區 | 既有 mention composer＋附件上傳。版面：上方輸入；輸入區下為插圖 widget（預覽／加圖，沿用 0.29 端點）；**Post 在發帖卡右下**。成功後清稿並刷新近期 feed。 |
| 8 | 近期帖 | 一則 entry＝一則卡：可見 `raw`（MdBlock，附件 embed 仍出圖）、時間、`id`。**不要**拼回單一 markdown。空 pool＝空態文案。不要做喜歡／轉發／獨立 permalink。 |
| 9 | 提問郵箱 | 釐清 **API 不變**。UI 改 DM：左＝會話列表（asking 各則＝一條進來的訊息）；右＝該則 thread（問題正文＋作答框；submit／dismiss 仍用現有端點）。**順帶補充（aside）** 留在本頁（例如列表上或右欄底的「你主動寫一句」），**不**改成 activity。 |
| 10 | API／store／dream | **不**改。STM 用 0.35 GET。Consolidate／Clarify／Seek 端點不變。 |
| 11 | Migrate | **有**：`migrate-0.28-to-0.36`（離線刪 `initialized_{weeks,months,years}.yaml` 與 STM `summary.md`／`nodes/`；空 pool 可從 summary 回填）。boot gate **≥ 0.36**。0.19–0.27 仍須先跑 `migrate-0.19-to-0.28`。 |

---

## 實作軌道（順序強制：1 → 2 → 3）

### Track 1 — 殼

- 做：App 佈局、左欄、hash 高亮、四個右欄都能開；Consolidate 從左欄消失但 `#/consolidate` 仍開事件＋沉澱 tab。
- 不做：事件 Twitter 細節、DM、改 Memory／Seek 內頁。
- 驗收：四項可切；舊 hash 不壞；搜索／記憶看起來與 0.35 等價（僅外殼不同）。

### Track 2 — 事件

- 做：發帖卡＋雙 tab＋STM 帖列表；沉澱整段搬進 tab 2。
- 不做：完整社群互動、改 dream API。
- 驗收：可發帖含圖；近期見 `entries`；可在 tab 2 入夢／審核。

### Track 3 — 提問郵箱

- 做：ClarifyScene DM 佈局；行為與現 API 等價。
- 不做：改 clarify 檔案格式、history 瀏覽 API。
- 驗收：可列表選則、作答、dismiss、aside。

---

## 非目標

- 記憶鏈橫向／節點 graph（0.36 後再決定；構想：[backlog](../backlog/INDEX.md)、草稿 [0.37.0](../0.37.0/INDEX.md)）
- Seek Ask／Search 功能改版、廢 `include_later` 以外的契約
- 改 STM／L0／dream HTTP（殘檔刪除走 hop，不改契約）
- 事件帖的 like／reply／獨立路由

---

## 錨點檔案

| 路徑 | 用途 |
|------|------|
| `web/src/App.tsx`、`Topbar.tsx` | 場景切換 |
| `web/src/lib/hashRoute.ts` | `#/` 契約（0.31） |
| `web/src/scenes/ActivitiesScene.tsx` | 發帖＋STM |
| `web/src/scenes/ConsolidateScene.tsx` | 沉澱 |
| `web/src/scenes/ClarifyScene.tsx` | 釐清帖牆 |
| `web/src/scenes/SeekScene.tsx` | 搜索（本版勿改內頁邏輯） |
| `web/src/i18n/zh-Hant.json`、`en.json` | 左欄文案 |
| `GET /memories/short-term-memory` | `{ entries, present }`（0.35） |
| `.agents/skills/engram-migration/scripts/migrate-0.28-to-0.36.ts` | 本版 hop |

---

## 驗收

- [x] 左欄四項：事件／搜索／提問郵箱／記憶；無獨立「沉澱」「尋找」左欄項
- [x] `#/seek`、`#/clarify`、`#/memory/nodes/{id}`、`#/consolidate` 仍可用
- [x] 事件：Post 右下；近期逐則 `entries`；沉澱 tab 可完成既有入夢審核
- [x] 搜索內頁與 0.35 等價
- [x] 提問郵箱 DM：作答／dismiss／aside 成功路徑與 0.35 API 相同
- [x] `version.md`／`changelog.md`／AGENTS／domain-language UI 循環描述＝0.36.0；**有** `0.28→0.36` hop；boot ≥0.36

---

## 與相鄰版本

| | 0.35.0 | **0.36.0** |
|--|--------|------------|
| 焦點 | 附件圖＋STM `entries[]` | **殼＋事件帖＋釐清 DM**；補 STM／chain 殘檔 hop |
| 導航 | Topbar 五 tab | 左欄四項 |
| 記憶內頁 | 列表 | **不變**（是否改鏈／圖：本版後再拍板） |
| Store migrate | 無（懶清） | **0.28–0.35 → 0.36**；boot **≥ 0.36** |
