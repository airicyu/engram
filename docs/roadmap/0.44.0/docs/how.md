# 0.44 HOW — reports list／get 與事件第三 tab

← [INDEX](../INDEX.md)（衝突時 **INDEX 勝**）

本檔鎖實作細節。產品範圍以 INDEX 已定案 A／B／C 為準。

---

## API

### `GET /dreams/reports`

掃描 `listDreamRuns()`，留下 `status === "committed"`，且 `reportPath(id)` 檔案存在（缺檔略過該筆，不當 500）。

排序：`committed_at` 字串降序（ISO 可 lexicographic）；無 `committed_at` 用 `created_at`；同分 `id.localeCompare` 升序。

`narrative_preview`：

1. 讀 report markdown。
2. 取 `## Narrative` 之後、下一個 server 段之前的正文（截斷點與 `server/src/dream/report/finalize.ts` 的 `extractNarrative` 相同：`## Node score involvements`／`## Clarify distill`／`## Structure notes`／`## Appendix — pending deploy`）。
3. 將該段空白摺成單一空格、trim。
4. 空 → `null`。
5. 否則取前 **80** 個 UTF-16 code unit，超出加 `…`（與 0.43 `answer_preview` 同規則）。

**不要**把 Appendix、Scope、Events covered 放進 preview。

Lock：與 `GET /dreams/pending` 相同，讀側不拿 dream write lock。

### `GET /dreams/reports/{id}`

`id` 非法（空、含 path 分隔）→ 既有 400 風格（與其他 `:id` 路由一致，勿新發明）。合法但不是「committed＋檔在」→ 200 `{ "present": false }` 即可，不必多欄位。

`present: true` 時 `report` 為檔案全文（UTF-8），**不要**再 finalize。

---

## Hash／場景

`SceneId` 增加 `"dream_reports"`。

| hash | 行為 |
|------|------|
| `#/dream-reports` | 事件＋第三 tab；進頁後若 list 非空且尚無選中 → 自動選最新並 **replace** 成 `#/dream-reports/{id}` |
| `#/dream-reports/{id}` | 同上 tab；選中該 id（即使 list 稍後才回來）；GET 單筆 `present: false` 則讀者空態 |
| `#/consolidate` | 仍第二 tab（不變） |
| `#/activities` 或 `#/` | 仍第一 tab |

`parseHash`：`parts[0] === "dream-reports"`（注意 URL 用 **hyphen**，scene 識別子用 **underscore** `dream_reports`，與 `zh-Hant` 檔名習慣分開）。只認一段 id（`parts[1]`）；更深 segment 忽略或仍選該 id（擇一寫進測試並固定：建議只取 `parts[1]`，多餘忽略）。

`serializeHash({ scene: "dream_reports" })` → `#/dream-reports`。帶選中 id 時 App 須能序列化 `#/dream-reports/{id}`——可擴充 `HashRoute`（例如 `{ scene: "dream_reports"; dream_run_id?: string }`）或在 ActivitiesScene 內 `writeHash`；**不要**把 id 塞進 memory hash。

Sidebar：`nav === "events"` 當 scene ∈ `{ activities, consolidate, dream_reports }`。

點左欄「事件」：仍進 `#/activities`（近期），**不要**記住第三 tab（與現況點事件回近期一致）。

---

## UI 版面

事件欄 `max-width` **維持**既有 `--events-col-width`。第三 `tabpanel` 建議 class 如 `events-dream-reports`：

```
[ panel-head: refresh ]
[ ul.dream-reports-list ]     ← 含 items 全部；overflow-y: auto
[ article.dream-report-read ] ← flex:1；overflow auto；MdBlock(report)
```

列表高度：**視窗上限**，不是筆數上限。建議 `max-height: min(40vh, 18rem)`（或 tabpanel 的 40%），`overflow-y: auto`。高螢幕可一次看見較多列；列數超過視窗時 **只在列表裡捲**，讀者區獨立捲報告正文。禁止：只 mount 前 N 筆、截斷 `items`、為列表再做分頁（與 INDEX B1「無分頁」一致）。筆數實務上限來自 TTL（預設 7 天的 committed 檔），不是 CSS。

列表列：按鈕／`role="listbox"`＋option 皆可，但須 `aria-selected`、鍵盤至少點擊可達。選中列視覺對齊 `.seek-recent-asks-item.is-selected` 或 `.inbox-thread.is-active`（擇一現有色，不要新主題）。

讀者區標題列可顯示時間＋id；正文只用 `MdBlock`（wikilink 行為與 pending 報告相同——Consolidate 現況未傳 `knownNodeIds` 則本 tab 亦可不傳，**不要**順便做記憶頁點選）。

窄／高視窗：同一欄上下堆疊即可，**不要** media-query 改左右欄（INDEX C1）。

自動選最新：僅當目前 hash **沒有** id（或 id 空白）。使用者若故意開 `#/dream-reports/some-id` 即使該 id 不在 list 也不改選最新。

圖示：第三 tab 用簡單文件／線條 icon（與 list／月亮沉澱區分即可），勿引入新 icon 套件。

繁中鍵建議：`events.tab_dream_reports`、`events.dream_reports_empty`、`events.dream_reports_missing`、`events.dream_reports_pick`（未選且列表空以外的提示；若永遠自動選最新，未選提示可省）。`l1_clear_pending` 複用 `consolidate`／status 既有句。

---

## 測試

至少：

- committed＋檔 → list 含該 `dream_run_id`；discarded 同目錄有 yaml＋md → **不含**
- 刪 md 留 committed yaml → 不含 list；GET id → `present: false`
- hash 單測：`#/dream-reports`、`#/dream-reports/dream-…`

phases：若易加則在既有夢 approve 後 `GET /dreams/reports` 見該 id；**不要**為本版重寫整條 dream phase。

---

## Track D — 區（2）多行答

錨點：`ActivitiesScene` 區（2）對 `item.answer` 的 `MdBlock`；`.stm-entry`／`.md-block`；必要時 `clarify.ts` 的 `extractSection`。

調查順序：

1. `GET /memories/clarify/pending` 該則 `answer` 是否已含第二行（若無 → 修 parser，仍不改 JSON 形狀）。
2. 若 API 已全文：查 CSS（`nowrap`、`line-clamp`、`max-height` 過小、`overflow: hidden`、flex 把最後一塊壓成一行）。問句在 `.clarify-pending-question` 內、答是 `.stm-entry` 直接子節點——選擇器不對稱時只修答側即可，但 STM 區（1）用同一 `.stm-entry .md-block` 要回歸。

驗收用虛構：

```text
第一句在第一行。
第二句必須看得見。
這是一句夠長、應在卡片寬度內自動折行的句子，用來確認不是 nowrap。
```

畫面須看見「第二句」與折行；不得只見「第一句在第一行。」

