# 0.31.0 — Hash 深鏈＋wikilink 可點＋chain 寫入時 node 互指

← [changelog](../../../changelog.md) · 上游：[0.30.0](../0.30.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**（2026-08-12；`test:phases` 綠；實作審查無未關 HIGH；M1／M2 已修）  
> **本版三項（只做這些）：**（1）Web **hash 路由**可深鏈場景／Memory 選中項；（2）`MdBlock` **渲染** node wikilink 為可點連結；（3）入夢寫 **day／week／month／year** chain 正文時，對**當時已存在**（live 或本輪 draft 新建）的 L2 node 寫入 P1 wikilink。**無** store migrate；**不做**歷史 chain 回填、**不做** graph GUI／vector。

## 產品句

> 人可用 `#/…` 打開某一場景或某一 node／chain 條目並分享連結；Memory（與共用 `MdBlock` 處）把 `[[nodes/…]]` 顯示成可點進對應節點的連結。入夢寫時間軸敘事時，提到已知 node 會留下與 Relation 同形的互指；若當時還沒有該 node、之後才建立，**不**回頭改舊 chain。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [HANDOFF.md](./HANDOFF.md) | 實作 agent 開工交接（讀序／禁區／貼上用 prompt） |
| 1 | **本檔 INDEX** | 範圍、定案、非目標、軌道、驗收 |
| 2 | [docs/hash-routing-and-wikilinks.md](./docs/hash-routing-and-wikilinks.md) | Hash 表、push／replace、preprocess、點擊行為 |
| 3 | [docs/chain-node-wikilinks.md](./docs/chain-node-wikilinks.md) | Chain／rollup prompt 契約、存在判定、非回填 |
| 4 | [docs/reasoning.md](./docs/reasoning.md) | 為何 hash、為何寫入時互指、為何不做歷史 backfill |

---

## 問題（本版要解決什麼）

1. Workbench 全站同一 URL（`/`），無法書籤／分享「某個場景、某個 node」。
2. Node／chain 正文裡的 P1 wikilink 經 `react-markdown` 後仍是 raw `[[…]]`，無法點、無法導航。
3. 0.28 只要求 **node 主檔** Relation 互指；**chain**（day summary／ledger、week／month／year）寫入時仍常純文字提人名／專案，Obsidian／未來 UI 抽邊看不到時間軸上的邊。

---

## 已定案

### A. Hash 路由（Web）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 機制 | **Hash router**（`location.hash`）；**不**引入必須依賴 history API path 的瀏覽器路由（避免靜態／Bun 服務 path fallback 問題） |
| 2 | 依賴 | **可不**加 `react-router`；手寫 parse／serialize＋`hashchange` 與 scene 狀態雙向同步即可。若實作選極薄 wrapper 亦可，但行為以本表為準 |
| 3 | 場景 | `#/activities`｜`#/consolidate`｜`#/clarify`｜`#/seek`｜`#/memory`（及下列 Memory 子路徑） |
| 4 | Memory chain | `#/memory/chain/{level}/{id}`，`level`∈`day`｜`week`｜`month`｜`year`；切到 Memory＋chain mode＋對應 level／選中 id |
| 5 | Memory nodes | `#/memory/nodes/{id}`；`id` 為 node id（URL-encode；中文 id 合法） |
| 6 | `#/memory` 無子路徑 | 一律 **chain mode**（**不**記憶上次 nodes／chain）；未指定 id 時選中行為＝現行 Memory 預設（例如列表第一項或空） |
| 7 | 預設／空 hash | 無 hash 或無法辨識 → 場景 **`activities`**；**懶寫**：進站**不**自動改成 `#/activities`；使用者**第一次**切換場景或 Memory 選中後才寫入 hash |
| 8 | History 寫入 | **場景 tab** 切換 → `pushState`／等同（瀏覽器「上一頁」可回上一場景）；**Memory 列表換選中項**（同 mode 內換 day／node id）→ `replaceState`／等同（避免狂點堆滿歷史）。詳見 [hash-routing](./docs/hash-routing-and-wikilinks.md) |
| 9 | 雙向 | Topbar／Memory 列表點選 → 更新 hash；改 hash／載入帶 hash → 還原 UI。未知 node／chain id：仍進入對應 mode，詳情區顯示既有空／失敗文案（**不** 404 整頁） |
| 10 | 其他場景深鏈 | 本版 **不**要求 consolidate pending 子狀態、seek 查詢字串進 hash（可之後加）；本版場景級＋Memory 選中即可 |

精確 path 表與邊界見 [hash-routing-and-wikilinks](./docs/hash-routing-and-wikilinks.md)。

### B. Wikilink 渲染（Web `MdBlock`）

| # | 題 | 決定 |
|---|-----|------|
| 11 | 作法 | **preprocess**：在餵給 `react-markdown` **之前**把可辨識的 node wikilink 轉成標準 markdown link |
| 12 | 目標 URL | `[label](#/memory/nodes/{id})`（與 #5 一致） |
| 13 | 必認形態 | （a）`[[nodes/{id}/{id}\|label]]`（b）`[[nodes/{id}/{id}]]`（label 預設＝`id`）。`{id}` 兩段必須相同（對齊 server Structure notes） |
| 14 | 短連 | （c）`[[{id}]]`／`[[{id}\|label]]`：**僅當** destination **不含 `/`**，且 `id` 屬於**當下已知 node id 集合**（Memory／Seek 已載入的 index，或 `MdBlock` 可選傳入 `knownNodeIds`）才轉換；否則**原樣保留**（避免把普通 `[[任意字]]` 誤成連結） |
| 15 | 不轉換 | `![[…]]` embed（附件等）；路徑不對稱 `[[nodes/a/b]]`（a≠b）；含 `#` heading／`^` block 的進階 Obsidian 語法（本版忽略、原樣保留） |
| 16 | 點擊 | 點轉換後的連結＝走 hash（#5），Memory 打開該 node；**不**開新分頁（一般 `<a href="#/…">`） |
| 17 | 套用範圍 | 所有使用 `MdBlock` 的表面（至少 Memory node／chain 正文、Consolidate report、Seek 命中預覽若走 `MdBlock`）一致 preprocess，避免有的地方可點有的不行 |

### C. Chain 寫入時 node 互指（Dream／Rollup）

| # | 題 | 決定 |
|---|-----|------|
| 18 | 寫入對象 | **Day summary**、**day ledger** 本輪 append block、**week／month／year** summary（含 rollup cascade writer 與 dream-files 若同輪改高階 summary） |
| 19 | 形態 | 與 0.28 **P1 相同**：機器寫入一律 `[[nodes/{id}/{id}\|{id}]]`（vault＝`memories/`；**不**加 `memories/` 前綴） |
| 20 | 何時必須留 link | 正文**提及**某個 L2 node，且該 node 在寫入當下屬於：**frozen `l2_current`／`existing_nodes`（live）**，或 **本輪 draft 已建立／將建立**的 node id → 須留下可點 P1 wikilink（口語名可保留在周圍文字或 `\|` 顯示名） |
| 21 | 何時不要 link | 一次性路人、不建立成 node 的名字；**寫入時尚未存在、本輪也不新建**的實體 → **只寫散文，不造假 id、不預留空 link** |
| 22 | 非回填（強制） | 若某日／週 chain **寫完之後**才新建同名 entity 的 node：**不**自動改寫歷史 summary／ledger；**不**做 migrate／batch backfill job。之後若 dream／amend **再次改寫**該檔，才可依當時存在集合補 link |
| 23 | Prompt | 更新 `server/prompts/dream-files.md`（chain 段）、`rollup-write-week.md`／`month`／`year`；`amend-dream.md` 若改 chain 正文則同樣適用「當時存在才 link」 |
| 24 | Mock | `MockOkRunner`／rollup mock 寫入的 chain 示例須含至少一處 P1（對已知 peer），供 `test:phases` 鎖定 |
| 25 | Soft lint（**必做**） | 擴充 draft **summary**（day／higher）軟警告：提及已知 peer id／顯示名卻無 `[[` → 寫入 report Structure notes（或同等段）；**不**擋 approve。Day **ledger** 本版**不做**逐 block 自動 lint（靠 prompt＋mock） |
| 26 | 附件 | 既有 `![[_attachments/…]]` 規則不變；node wikilink 與 attachment embed **並存** |
| 27 | Store | **無** migrate hop；**不**抬 boot gate（仍 ≥0.28）；**不**改 `store_version` 字串義務 |

細節與反例見 [chain-node-wikilinks](./docs/chain-node-wikilinks.md)、[reasoning](./docs/reasoning.md)。

---

## 非目標

- History API path router（`/memory/nodes/…` 無 hash）或 SSR
- Engram 內 network graph GUI（其後出貨為 [0.37.0](../0.37.0/INDEX.md)）
- Vector／語意搜尋
- 全庫／歷史 chain **backfill** wikilink
- Node merge；typed `graph/links.yaml`
- Clarify badge、Seek query 進 hash
- Shared Zod monorepo package
- 改 Obsidian 以外的第三種 link 方言

---

## 實作軌道

### Track A — Hash 路由

- **做：** hash parse／serialize；`App`／Topbar／`MemoryScene` 與 hash 雙向同步；深鏈 Memory node／chain
- **不要做：** path-based router；把 ask job id 等暫態塞進 hash
- **驗收：** 手動／自動化：開 `#/memory/nodes/eric` → Memory＋nodes＋選中 eric；切 tab → hash 更新

### Track B — MdBlock wikilink preprocess

- **做：** 共用 preprocess 函式（web）；`MdBlock` 接入；點擊進 `#/memory/nodes/{id}`；單元測試涵蓋 #11–#13
- **不要做：** 完整 Obsidian wikilink 規格（heading／block／embed alias）
- **驗收：** 顯示「eric」之類可點文字，不再露出 raw `[[nodes/eric/eric|eric]]`（P1）；未知短連不誤轉

### Track C — Chain 寫入互指

- **做：** prompt＋mock＋**summary soft lint（必做）**；phases 鎖定 mock chain 含 P1
- **不要做：** 歷史回填腳本；ledger 逐條強制 lint；改 live 而不經 draft／approve
- **驗收：** mock dream 後 draft／approve 的 day summary（或 ledger block）含 `[[nodes/…]]`；缺 link 可出現 Structure notes 警告；文件／AGENTS 一句話寫明「chain 寫入時互指、不回填」

### Track D — 文件收尾

- **做：** `docs/api-docs` 若無 API 變更可略；更新 `docs/domain-language.md`（chain 亦可含 P1）、`AGENTS.md` 出貨時版本句、`changelog.md`／`version.md`
- **不要做：** 假裝有新 HTTP 端點

---

## 驗收 checklist

- [x] `#/consolidate` 等五場景可深鏈；重新整理後場景正確
- [x] `#/memory/nodes/{id}`／`#/memory/chain/{level}/{id}` 可深鏈；列表點選會改 hash
- [x] Node／chain 正文 P1 wikilink 渲染為可點連結並導向該 node
- [x] 短連僅在 known id 時轉換；`![[attachments…]]` 不被當成 node link 拆壞
- [x] dream-files／rollup prompts 要求 chain 對存在中的 node 寫 P1；mock＋`test:phases` 綠
- [x] 文件明寫：**不**做歷史 chain wikilink backfill
- [x] **無** store migrate；boot gate 仍 ≥0.28

---

## 錨點檔案（改前必讀）

| 路徑 | 用途 |
|------|------|
| `web/src/App.tsx` | 場景 state，無路由 |
| `web/src/scenes/MemoryScene.tsx` | chain／nodes 選中態 |
| `web/src/components/ui.tsx` | `MdBlock`＋`react-markdown` |
| `server/prompts/dream-files.md` | day／node 寫入；現僅 Relation 強制 wikilink |
| `server/prompts/rollup-write-*.md` | 高階 summary |
| `server/src/dream/report/structure-notes.ts` | node 主檔 soft lint（可擴 summary） |
| `server/src/store/memories/nodes.ts` | `nodeWikilink()` |
| `server/src/agent/dream/mock.ts` | phases 用 chain／Relation 示例 |

---

## 與 0.28／0.30 對照

| | 0.28 | 0.30 | **0.31** |
|--|------|------|----------|
| Node Relation P1 | ✅ | — | 維持 |
| Chain 正文 P1 | ❌ | — | **寫入時若 node 已存在 → ✅**；不回填 |
| UI 渲染 `[[…]]` | raw | — | **可點** |
| URL 深鏈 | 無 | — | **hash** |
| Clarify | — | ✅ | 不動 |

---

## 開工前仍須拍板

（無。上述已定案足以開工；若 design-review 發現洞，併回本表後再實作。）

---

← [0.30.0](../0.30.0/INDEX.md) · [backlog](../backlog/INDEX.md) · [GUIDELINES](../GUIDELINES.md)
