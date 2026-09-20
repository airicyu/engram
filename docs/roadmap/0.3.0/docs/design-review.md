# Design review — 0.3.0 搜尋、釐清、附圖、節點圖、工作台殼

- 日期：2026-09-20（Asia/Hong_Kong）
- 輪次：**初審**＋**複審**（本檔為累積審查紀錄；穩定 ID 不重編號）
- 角色：設計審查（不改 INDEX／HOW／reasoning／HANDOFF／程式；不以本檔當已定案）
- 對照基準：[`../INDEX.md`](../INDEX.md) 已定案＋驗收；[`how.md`](./how.md)、[`reasoning.md`](./reasoning.md)、[`../HANDOFF.md`](../HANDOFF.md)；上游 [`../../0.2.0/INDEX.md`](../../0.2.0/INDEX.md)；構想 [`../../backlog/image-attachments.md`](../../backlog/image-attachments.md)（不得蓋過本版）
- 現行程式抽樣：`server/index.ts`、`server/store.ts`、`server/paths.ts`、`web/app.js`、`web/style.css`、`.agents/skills/engram-lite-distill/SKILL.md`、`.agents/skills/engram-lite-ask/SKILL.md`；契約現況 `docs/data-spec.md`、`docs/api.md`（皆為 **0.2.0 shipped** 語意）
- **總評（複審）：無未關閉 HIGH；M1–M6／L1–L3 均已在 INDEX／HOW／HANDOFF 落地並核對關閉；設計閘門通過；無仍開且應修的 MEDIUM。** 本檔仍非產品已定案（已定案以 INDEX 為準）；出貨前 Track F 同步根契約。

---

## Findings（本輪）

關閉＝已寫進 INDEX／HOW／HANDOFF；仍開＝契約仍分叉；非阻擋＝記錄即可。

### HIGH

（無）

本版 INDEX／HOW／HANDOFF／reasoning 與產品硬契約一致：skills 寫 live `memories/`；server 僅讀檔、機械寫入、202 派 Pi；非目標明示無 dream report／approve／discard／amend、無 setup wizard、無 Vite／React、無內建 cron。未發現與非目標不可調和、或主路徑必須搬入寫作引擎／approve 的設計。現碼尚未實作本版能力，**不**計為設計 HIGH。

### MEDIUM

#### M1 — INDEX 已定案未列釐清列表 GET — **已關閉**

- **關閉位置（複審核對）：** INDEX 已定案 **#6b**（`GET /clarify/asking`、`GET /clarify/pending` → `{ items: [{ id, ts, markdown }] }`，新→舊；無題 200＋空陣列）；HOW 釐清 GET 段；HANDOFF paste-ready 含 `GET /clarify/asking|pending`。

- **問題：** [`how.md`](./how.md) 寫明 `GET /clarify/asking`、`GET /clarify/pending` → `{ items: [{ id, ts, markdown }] }`（新→舊）；INDEX 已定案表僅有 submit／DELETE／aside，未把這兩支列表 GET 寫進已定案。提問郵箱 UI（`#/clarify`）與驗收「Distill 可在 asking 寫出一題」的可測展示都依賴列表。
- **為何 MEDIUM：** 主契約在 HOW 已有，故非「未定 API 臆造」級 HIGH；但實作若只掃 INDEX 已定案表易漏網或自造形狀。
- **建議寫進已定案：** `GET /clarify/asking` 與 `GET /clarify/pending` 回 200 `{ items: [{ id, ts, markdown }] }`（新→舊）；無題時 `items: []`。非法路徑仍走既有 404 規則。

#### M2 — `POST /clarify/aside` 的 id／檔名規則未寫死 — **已關閉**

- **關閉位置（複審核對）：** INDEX 已定案 **#6**（aside 與 #4 同 id／檔名；`kind: aside`；直寫 `pending/`）；HOW Aside 段（id／檔名／frontmatter／`raw`）。

- **問題：** INDEX 已定案 #4 只定義 asking 新建之 `cla_`＋日＋`_`＋6 位；#6 aside「直接在 `pending/` 新建」未規定 id／檔名是否同一格式、是否必含 `kind: aside`（HOW 有 frontmatter 例，INDEX 無）。
- **建議寫進已定案：** aside 與 asking **同一** `id`／檔名規則；檔落在 `clarify/pending/{id}.md`；frontmatter 必含 `id`、`ts`，且 `kind: aside`；正文為人寫的 `raw`（可無 `## Answer` 段）。

#### M3 — 事件 embed 與 `attachments[]` 對稱邊界未寫死 — **已關閉**

- **關閉位置（複審核對）：** INDEX 已定案 **#10**（集合對稱、單邊／缺檔／alias→400、無圖＝0.2）；驗收句同步「僅 embed／僅 attachments／缺邊→400」。

- **問題：** INDEX #10 謂 `attachments` 可選，且「若有」則集合須與 embed 路徑相同；驗收寫「embed＋`attachments[]` 對稱」。未寫死：(a) 僅有精確 embed、無 `attachments` 鍵 → 200 還是 400；(b) 僅有 `attachments[]`、`raw` 無對應 embed → 是否 400；(c) 重複 embed／重複 path 如何正規化。
- **建議寫進已定案（擇一寫死，推薦）：** 有任一 embed 或非空 `attachments` 時，兩邊 path **集合必須相等**（順序不論）；缺檔、`|alias`、非法 path → 400；無 embed 且無 `attachments` 鍵（或省略）→ 與 0.2 相同。`attachments[].relationship` trim 後非空。

#### M4 — 驗收「吸收」欠客觀判準 — **已關閉**

- **關閉位置（複審核對）：** INDEX 驗收（客觀吸收：fixture 關鍵字 ∈ day／node 正文，或 frontmatter `absorbed_at`＋已在 `history/`；虛構字串）。HOW 允許 `absorbed_at`。

- **問題：** 驗收「再 distill 後該檔在 `history/` 且相關 node／day 有吸收」中「有吸收」無法單靠檔案存在斷言。
- **建議寫進驗收：** 至少其一可測：(1) 對應 day 或相關 node 正文出現答案中的約定關鍵字（fixture 固定字串）；或 (2) frontmatter 含 `absorbed_at` 且檔已在 `history/`（HOW 已允許 `absorbed_at`）——並註明 fixture 題目／答案用虛構字串。

#### M5 — INDEX #15「空陣列」與各 API envelope 用語不一致 — **已關閉**

- **關閉位置（複審核對）：** INDEX 已定案 **#15**（200＋既定 JSON envelope；集合欄空陣列；404 範圍；與 #6 `present: false` 並存）。

- **問題：** #15 寫「200 空陣列」；實際已定案／HOW 為 `{ hits: [] }`、`{ items: [] }`、`{ nodes: [], edges: [] }` 等物件包陣列。
- **建議：** 改為「200＋該端點既定 JSON，集合欄為空陣列」；404 僅未知路由或附件消毒後檔不存在（與 #6 缺題 200／`present: false` 並存）。

#### M6 — 現行 `data-spec.md`／`api.md` 仍為 0.2.0，缺「實作期間以本版為準」一句 — **已關閉**

- **關閉位置（複審核對）：** INDEX **「實作期間契約權威」**；HOW 開頭呼應。根目錄契約仍 0.2 語意屬 Track F 出貨前同步，不再構成契約分叉。

- **問題：** 錨點契約檔尚無 `/search`、`/clarify/*`、`/attachments`、`/nodes/graph`、事件 `attachments[]`、`memories/clarify/`。Track F 已排同步；初審不要求先改契約檔。但字面並陳時，實作／測試 agent 可能誤跟 0.2 契約。
- **建議：** 在 INDEX 文件地圖或 HOW 開頭加一句：本版落地前以 **本版 INDEX＋HOW** 為準；出貨前 Track F 同步 `docs/data-spec.md`、`docs/api.md`、`AGENTS.md`（`version.md` 出貨才 bump）。

### LOW

| ID | 狀態 | 說明 |
|----|------|------|
| L1 | **已關閉** | HOW：UI 搜尋走 `GET /search`，**不**取代 Ask skill 讀檔範圍；`engram-lite-ask` 仍只讀 chain＋pending。 |
| L2 | **已關閉** | HANDOFF paste-ready 已含 `GET /clarify/asking|pending`（隨 M1）。 |
| L3 | **已關閉** | HOW 搜尋節註明 **刻意不掃** `clarify/`（僅郵箱 UI／`GET /clarify/*`）。 |

---

## 驗收對照

| INDEX 驗收句 | 設計層是否可測 | 缺口 |
|--------------|----------------|------|
| `GET /search?q=` 命中 fixture；空 q→400；無命中→200 `{ hits: [] }` | 可測 | 無（路徑／上限／掃檔範圍已定案） |
| 尋問頁可搜、可 ask、可看近 ask job 不重跑 | 可測（UI＋`GET /jobs` 濾 `kind===ask` 終態、`input.q`／`output.text`） | 「近 20」與 API「近 50」並存：前端切片即可；可選寫進 HOW |
| Distill 寫 asking→submit→pending→再 distill→history 且吸收 | 部分可測 | M4／M1 已關閉；可客觀自動化 |
| aside 不進 `pool/pending.jsonl` | 可測 | M2 已關閉 |
| 上傳 png 201；events embed＋attachments 對稱；缺檔／alias→400 | 可測 | M3 已關閉 |
| Day 稿含同一 `![[…]]`；mock 不必真看圖 | 可測 | 無 |
| `GET /nodes/graph` 雙端存在成邊；死連忽略 | 可測 | 無 |
| 左欄四景；圖≥2 點有邊；預覽走 file GET | 可測 | HOW 補 `#/memory/nodes`、`#/memory/graph`（與 INDEX「記憶內切」一致，非分叉） |
| 無 React／Vite；無 `dreams/` | 可測 | 非目標已寫清 |
| `bun test` 全綠；不碰真人 store | 可測 | 實作階段 |

---

## 與現碼抽樣

現碼未做本版 ≠ 設計 HIGH。抽樣結論：

| 錨點 | 現況（0.2.0） | 與 0.3.0 提案 |
|------|---------------|----------------|
| `server/index.ts` | 僅 `/status` `/pool` `/chain` `/nodes` `/jobs` `/events` `/distill` `/ask` 與靜態 web | 無 `/search`、`/clarify/*`、`/attachments`、`/nodes/graph` — **待實作** |
| `web/app.js` | hash 以 `events`／`chain?level=` 等為主，非左欄四景 | 提案 `#/events` `#/seek` `#/clarify` `#/memory`（及 HOW 子 hash）— **待實作**；非互斥，屬取代殼 |
| distill／ask skills | 無 clarify 出題／吸收、無 attachments 教學 | INDEX／Track B／C 要求補 skill 段 — **待實作** |
| `docs/api.md`／`data-spec.md` | 無本版端點／`memories/clarify/`／事件 `attachments[]` | M6 已關閉（權威句）；Track F 仍作出貨同步 |
| package／web | 無 React／Vite 依賴 | 與非目標一致 |
| 硬契約 | distill skill 明文不要 dream／approve | 與本版非目標一致；提案未偷渡 |

未發現「現碼行為與本版已定案永久互斥、且本版又要求保留該行為」的設計衝突。

---

## 路徑／HTTP 字面對照（特別檢查）

| 主題 | INDEX | HOW | HANDOFF | 結論 |
|------|-------|-----|---------|------|
| 搜尋 | `GET /search?q=`；掃 chain／nodes／pending；不掃 archived／jobs／附件 bytes；`{ hits:[{path,snippet}] }`；path 相對 vault | 同；snippet ±40 字 | `GET /search` 機械掃同範圍 | **一致** |
| 釐清目錄 | `memories/clarify/{asking,pending,history}/`；`cla_`＋日＋6 位 | 同；submit 加 `## Answer` | 同目錄與 HTTP 職責 | **一致**；列表 GET 已進 INDEX #6b（M1 已關閉） |
| 附圖 | `POST /attachments`→正式 `_attachments/uploads/{day}/{file}`；`GET /attachments/file?path=`；精確 `![[…]]` 無 alias | 同；校驗正則 | `POST /attachments` 一步正式 | **一致** |
| 節點圖 | `GET /nodes/graph`；wikilink 雙端存在；無向去重 | 同；`title`＝`# ` 或 id | `GET /nodes/graph` | **一致** |
| UI hash | `#/events` `#/seek` `#/clarify` `#/memory` | 另定 `#/memory/nodes`、`#/memory/graph`；禁止 consolidate／dream-reports | 左欄四景 | **一致**（子 hash 屬 HOW） |
| data-spec／api | （本版未改檔） | — | Track F | 權威句已補（M6 已關閉）；根契約 Track F |

偷渡檢查：INDEX／HOW／HANDOFF／reasoning **無** dream staging、approve UI、React／Vite 工具鏈、server 寫作規則引擎、setup wizard。釐清「直接寫 live、無 report」在 reasoning 明示為刻意。

隱私：本報告未引用真人記憶正文；HOW／本檔結構例皆為虛構（Acme／cla_ 示例）。

---

## 修復追蹤表

| ID | 級 | 狀態 | 關閉位置 |
|----|----|------|----------|
| M1 | MEDIUM | **已關閉** | INDEX #6b；HOW 釐清 GET；HANDOFF paste |
| M2 | MEDIUM | **已關閉** | INDEX #6；HOW Aside |
| M3 | MEDIUM | **已關閉** | INDEX #10＋附圖驗收句 |
| M4 | MEDIUM | **已關閉** | INDEX 吸收驗收（關鍵字或 `absorbed_at`） |
| M5 | MEDIUM | **已關閉** | INDEX #15 |
| M6 | MEDIUM | **已關閉** | INDEX「實作期間契約權威」；HOW 開頭 |
| L1 | LOW | **已關閉** | HOW Ask／搜尋句 |
| L2 | LOW | **已關閉** | HANDOFF paste-ready |
| L3 | LOW | **已關閉** | HOW 搜尋節「刻意不掃 clarify/」 |

---

## 歷審摘要

| 輪次 | 日期 | 結論 |
|------|------|------|
| 初審 | 2026-09-20（HKT） | 無未關閉 HIGH；提案可行；門檻就 HIGH 可過。應修 M1–M6（預設）；L1–L3 不擋。待規劃收斂後複審核對關閉。 |
| 複審 | 2026-09-20（HKT） | 逐條核對規劃收斂後 INDEX／HOW／HANDOFF：M1–M6、L1–L3 **全部已關閉**。無未關 HIGH；無仍開應修 MEDIUM；**設計閘門通過**。未新開阻擋項。現碼未實作本版仍 ≠ HIGH。可進實作（仍勿 commit 除非使用者要求）。 |


---

## 規劃收斂紀錄（2026-09-20 HKT，初審後）

本 session（規劃）已依初審 findings 改文件（**未改產品碼、未 commit**）：

| ID | 處理 |
|----|------|
| M1 | WSL INDEX 已有 #6b 釐清列表 GET；與 HOW 對齊為契約。標 **已關閉（文件）**。 |
| M2 | INDEX #6＋HOW：aside 同 id 規則、`kind: aside`、直寫 `pending/`。 |
| M3 | INDEX #10＋驗收：embed／`attachments[]` 集合對稱；單邊 → 400。 |
| M4 | 驗收吸收改客觀判準（fixture 關鍵字或 `absorbed_at`）。 |
| M5 | INDEX #15：200＋既定 envelope、集合欄空陣列。 |
| M6 | INDEX 新增「實作期間契約權威」；HOW 開頭呼應。 |
| L1 | HOW：UI search 不取代 Ask 讀檔範圍。 |
| L2 | HANDOFF paste-ready 已含 clarify GET。 |
| L3 | HOW 搜尋節註明刻意不掃 `clarify/`。 |

複審（本輪）已核對上表：**均屬實並已關閉**。閘門通過後可實作產品碼（勿 commit 除非使用者要求）。

---

## 複審核對（2026-09-20 HKT）

角色：設計審查複審（只認檔案；不改 INDEX／HOW／reasoning／HANDOFF／程式；不 commit；不貼真人記憶正文）。

### 關閉核對結果

| ID | 複審結論 | 證據（檔案位置） |
|----|----------|------------------|
| M1 | **已關閉** | INDEX `#6b`；HOW `GET /clarify/asking`／`pending`；HANDOFF paste |
| M2 | **已關閉** | INDEX `#6` aside 規則；HOW Aside 段 |
| M3 | **已關閉** | INDEX `#10` 對稱規則；附圖驗收句 |
| M4 | **已關閉** | INDEX 驗收客觀吸收判準；HOW `absorbed_at` |
| M5 | **已關閉** | INDEX `#15` envelope 用語 |
| M6 | **已關閉** | INDEX「實作期間契約權威」；HOW 開頭 |
| L1 | **已關閉** | HOW：UI `GET /search` 不取代 Ask 讀檔範圍 |
| L2 | **已關閉** | HANDOFF paste 含 clarify 列表 GET |
| L3 | **已關閉** | HOW 搜尋節刻意不掃 `clarify/` |

### 硬契約抽樣（複審）

- skills 寫 live `memories/`；server 非寫作引擎：INDEX #1／reasoning／skills 與提案一致。
- 無 dream／approve／React／setup wizard／內建 cron：INDEX 非目標＋reasoning 否決段仍在；提案未偷渡。
- 現碼（`server/index.ts`、`web/app.js`）尚無本版端點／四景 — **待實作**，不計設計 HIGH。
- 根目錄 `docs/data-spec.md`／`docs/api.md` 仍 0.2 語意 — 已由 M6 權威句覆蓋實作期間讀法；Track F 出貨前同步。

### 新 findings

（無。）未發現新的 HIGH／應修 MEDIUM。LOW 級用語潤飾非本輪需要。

### 閘門判定

| 項 | 結果 |
|----|------|
| 未關 HIGH | **無** |
| 未關／應修 MEDIUM | **無**（M1–M6 已關閉） |
| 未關 LOW | **無**（L1–L3 已關閉；本不擋閘門） |
| 設計閘門 | **通過** — 可依 HANDOFF 進實作 |
