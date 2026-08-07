# 0.25.0 — Node standing understanding（四段骨架）

← [changelog](../../../changelog.md) · 上游：[0.24.0](../0.24.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**  
> 入夢寫入的 node `what.md` 改為 **standing understanding**（固定四段小標），不再把 day chain 抄成 node 日記。**無** store migrate／**不**改 API wire 欄位名。來源構想曾列 backlog（出貨後刪除；真相以本版為準）。

## 產品句

> 使用者在 Consolidate approve 之後，Memory／Seek 看到的 node 正文應是「這個人／專案／主題**現在是什麼**」的可維護模型（Identity／Relation／Standing facts／Current situation），而不是逐日事件流水；事件細節仍在 chain。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、軌道、驗收 |
| 2 | [docs/standing-understanding.md](./docs/standing-understanding.md) | 檔內骨架、dream 寫入規則、與 chain 分工 |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何單檔四段、為何不改 API／不做回填 job |
| 4 | [docs/node-facets-only-what-investigation.md](./docs/node-facets-only-what-investigation.md) | 背景調查：為何只有 what／幽靈 facet（已結案） |

---

## 問題（本版要修什麼）

現行 `server/prompts/dream-files.md` 幾乎只規定可寫路徑 `nodes/*/understand/what.md`，**沒有**規定好的長期理解長什麼樣。實務上 agent 常把短期事件 **append 成 node 私有時間軸**，與 day chain **重複**，Seek／Memory 看到雜訊而非認知模型（例：關係／職稱埋在流水帳與單日事件之間）。

本版 **不**恢復舊多 facet 檔（who／open…）；先把**單檔**做對。

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 產品分工 | **Node `what.md`**＝standing understanding（定義、關係、穩定事實、當前狀態濃縮）。**Chain**＝發生過什麼。**Future-sight**＝近程錨點。規則：**事件進 chain；對理解的沉澱結論才進 node** |
| 2 | 路徑／API | 路徑維持 `memories/nodes/{id}/understand/what.md`。對外仍回 **`what_current`**（整檔正文）。**本版不改** wire 欄位名；改名見 [0.26.0](../0.26.0/INDEX.md) |
| 3 | 檔內骨架 | 固定四段 `##` 標題（英文標題，與下表一致）；整檔＝最新理解；**無** `## Current`／`## History` |
| 4 | 四段標題 | 必須依序出現：`## Identity` → `## Relation` → `## Standing facts` → `## Current situation`（用字不可改） |
| 5 | 空段 | **保留四段標題**；該段無內容時正文為 `_None_`（單獨一行或段內唯一內容即可） |
| 6 | 寫入方式 | 更新既有 node：dream agent **整檔 rewrite** 為符合骨架的最新理解；**禁止**在檔尾再貼一天流水帳 |
| 7 | 與本輪事件 | 細節寫 **day ledger／summary**；node 只吸收「因此對長期認知多知道／改了什麼」（可寫進 Standing facts 或 Current situation 的濃縮句，可含「截至 YYYY-MM-DD」） |
| 8 | 新建 node | draft seed 的 `what.md` **一開始**即含四段骨架（空段 `_None_`）；不要只丟一行 raw |
| 9 | Report | `## Narrative` → `### Long-term updates`：描述**理解如何變**，不要列事件複本 |
| 10 | 既有資料 | **D1 懶改寫**：不開全庫回填 job；某 node 被後續 dream **涉及並更新**時依新規則 rewrite。不 bump `store_version` |
| 11 | Context 提示 | 凍結 dream context／prompt 須讓 agent 知道：若 live `what.md` 像日記，本輪應改寫為 standing model（四段） |
| 12 | UI | **不改** Memory／Seek 結構；既有 markdown 渲染顯示四段即可 |
| 13 | 機械校驗 | **本版不**在 approve 時因缺小標而 4xx 拒批（避免舊 draft／半寫檔卡死）。靠 prompt＋mock／測試約束；文件寫明期望形狀 |
| 14 | Kind | **不**做多套互斥 schema；prompt 可註：person 偏重 Relation；project／theme 偏重 Identity／Standing facts；不適用的段仍留標題＋`_None_` |
| 15 | Store | **無** migrate；路徑與檔名不變 |

### 四段含義（寫進 prompt 的摘要）

| 小標 | 放什麼 | 不放什麼 |
|------|--------|----------|
| **Identity** | 是誰／是什麼（定義） | 逐日事件 |
| **Relation** | 與使用者的關係（人／組織常用） | 待辦、單次約會流水 |
| **Standing facts** | 穩定、已確定、不依賴單一日期的事實 | 「昨天去了哪」類情節 |
| **Current situation** | 當前狀態的**濃縮**（可截至某日） | 多日事件列表／chain 複本 |

骨架範例與更細規則見 [docs/standing-understanding.md](./docs/standing-understanding.md)。

---

## 非目標

- 恢復 `open.md`／`resolve_open`／who／why 等多 facet **檔**
- API 改名／`understanding` alias（→ [0.26.0](../0.26.0/INDEX.md)；本版刻意不做）
- D2 全庫回填 job、強制改寫從未再被 dream 碰到的 node
- Approve 時 schema 硬拒缺標題的 `what.md`
- AI 反思補問、vector search、node merge、network graph
- 改 chain／future-sight 路徑或廢掉 chain
- 改 `store_version`

---

## 實作軌道

### Track A — Dream prompt 與 mock

- **做：** 更新 `server/prompts/dream-files.md`：產品分工、四段骨架、`_None_`、整檔 rewrite、禁止日記 append、新建 seed、Long-term updates 寫法；mock dream（`server/src/agent/dream/mock.ts`）新建／更新 `what.md` 產出含四段標題
- **不要：** 改回 JSON `extract.md` 主路徑；在 prompt 復活多 facet 檔路徑
- **驗收：** mock 跑通後 draft／live `what.md` 含四段；人工讀 prompt 與 [standing-understanding](./docs/standing-understanding.md) 一致

### Track B — Context／文件語意

- **做：** dream 凍結 context 或 prompt 注入「日記式 what → 改寫為 standing」；`docs/domain-language.md`、`docs/api-docs/api.md`（及必要時 `AGENTS.md`）註明：`what_current`＝`what.md` **整檔** standing understanding（四段期望）；**不**改 JSON 鍵名
- **不要：** 新增 HTTP 端點或 response 欄位
- **驗收：** 文件與 api 註解可被新 agent 讀懂；grep `what_current` 語意無「僅 Current 段」誤導（0.16 整檔語意保留並強化）

### Track C — 測試與出貨儀式

- **做：** self-test 或既有 phase：mock dream 後讀某 node `what.md`，assert 四段標題字串存在；出貨時更新 `version.md`／`changelog.md`；backlog 條目按 GUIDELINES 處理（出貨後刪或改連到本版）
- **不要：** 為本版寫 migrate script
- **驗收：** checklist 全勾

---

## 驗收

- [x] `dream-files.md` 含：chain vs node 分工、四段標題原文、`_None_`、整檔 rewrite、禁止日記 append、新建四段 seed、Long-term updates 指引
- [x] Mock dream 新建 node 的 `what.md` 含四段標題；更新既有 node 時 rewrite 後仍含四段（非檔尾只 append 一行）
- [x] 文件：`what_current` 說明＝整檔 standing understanding；**response JSON 鍵名未改**
- [x] **無** `store_version` bump；**無** API 新欄位
- [ ] 人工抽樣（可選真 store）：對曾寫成日記的 node，新一輪涉及該 node 的 dream approve 後，`what.md` 主幹為四段理解，該日情節在 chain 而非 what 主幹
- [x] UI 無需改碼即可顯示四段（回歸：Memory node detail／Seek node 卡仍讀 `what_current`）

---

## 錨點

| 路徑 | 用途 |
|------|------|
| `server/prompts/dream-files.md` | **主改**：dream 寫入契約 |
| `server/src/agent/dream/mock.ts` | mock 寫 what.md／新建 node |
| `server/src/dream/execute/context.ts`（或同等） | 凍結 context／`l2_current` |
| `server/src/store/memories/nodes.ts` | 讀整檔 `what_current` |
| `server/src/memory/browse.ts` | `GET /memories/nodes/{id}` |
| `docs/api-docs/api.md` | `what_current` 契約註解 |
| `docs/domain-language.md` | what／node 詞彙 |
| `web/src/scenes/MemoryScene.tsx` | 顯示正文（本版預期不改） |

---

## 與上一版對照

| | 0.24.0 | 0.25.0 |
|--|--------|--------|
| 入夢空 pool | rollup-only | **不變** |
| Node `what.md` | 無結構契約（易成日記） | **四段 standing understanding** |
| API `what_current` | 整檔正文 | **鍵名不變**；語意文件強化 |
| Store migrate | 無 | **無** |

## 開工前仍須拍板

無。
