# 0.18.0 — Seek 納入未來視 ＋ window 預設 365 日

← [changelog](../../../changelog.md) · 上游：[0.17.0](../0.17.0/INDEX.md) · current: [version](../../../version.md) · 寫作規範：[GUIDELINES.md](../GUIDELINES.md)

> **狀態：** **shipped**  
> 來源：原 backlog「Recall／Seek × 未來視」（出貨後已刪除）；定案見本 INDEX／docs  
> 建立於 0.17 未來視雙區（`hot.md`／`later.md`）已穩之後：本版做 **讀側閉環**（Seek）與 **准入窗預設加長**，不改寫入／入夢／機械維護主契約。

## 產品句

> Seek 能從未來視找答案：Search 用 script 掃 hot＋later（成本低、無 later 專用 flag）；Ask 預設只讓 AI 讀到 hot（與 short-term／nodes／chain），要用較遠錨點時由使用者開 `include_later`——同時把未來視准入窗預設從 90 日改為 365 日，讓一年內檔期能進 later 停泊。

## 文件地圖（閱讀順序）

| # | 文件 | 內容 |
|---|------|------|
| 0 | [CLAUDE.md](../../../CLAUDE.md) | 操作邊界；出貨時須同步 |
| 1 | **本檔 INDEX** | 範圍、已定案、非目標、Track、驗收 |
| 2 | [docs/seek-future-sight.md](./docs/seek-future-sight.md) | Search／Ask 契約、flag、prompt／response 形狀、UI |
| 3 | [docs/reasoning.md](./docs/reasoning.md) | 為何 Search 全掃、Ask 要 flag、否決兩段式與「只 hot 永久」 |
| 4 | [0.17 store-and-zones](../0.17.0/docs/store-and-zones.md) | 現行兩檔、分桶、`window_days`／`hot_days`（本版只改 **預設** window） |
| 5 | （已刪）backlog recall-future-sight | 舊「建議只注 hot」構想；本版 supersede 讀側策略 |

**讀完 1–3 即可開工**；無需依賴聊天紀錄。  
**不可開工條件：** 無（待拍板已清空）。

---

## 與 0.17 對照

| 題 | 0.17 | 0.18 |
|----|------|------|
| `future_sight_window_days` 預設 | **90** | **365**（`hot_days` 預設仍 **30**；優先序仍 workspace → 否則 env → 否則預設） |
| Store 佈局／入夢維護 | `hot.md`／`later.md`；入夢前 script maintain | **不變** |
| `GET /memories/search` | 不含未來視 | **可掃未來視**（hot＋later）；見已定案 |
| `POST /memories/ask` | prompt **禁止**讀 `memories/future-sight/` | **可讀 hot**；**`include_later: true` 才讀 later** |
| 兩段式 Ask（先找完再決定讀 later） | — | **不做**（見 reasoning） |
| Migration／`store_version` | 0.17.0 | **不強制**因本版改預設而 migrate；見已定案 #8 |

---

## 已定案（勿再問、勿擅自改語意）

| # | 題 | 決定 |
|---|-----|------|
| 1 | 本版性質 | **讀側＋預設窗**：Seek 納入未來視；改 `window_days` **程式／文件預設**為 365。**不**改分桶公式、item 格式、入夢前 maintain、approve 閘門 |
| 2 | Window 預設 | `DEFAULT_FUTURE_SIGHT_WINDOW_DAYS`：**90 → 365**。Env／workspace 鍵名不變。若 workspace（或有效 env）**已寫** `future_sight_window_days`，**維持該值**，不被本版預設蓋過 |
| 3 | Hot 預設 | `future_sight_hot_days` 預設仍 **30**；本版不改 |
| 4 | Search 與 later | **無**「是否含 later」的 flag。凡納入未來視之 search，**一律**對 `hot.md` 與 `later.md` 做關鍵字命中（script；只回命中 item） |
| 5 | Search × `scope` | 新增 scope token **`future`**。省略 `scope` 時預設為 **`l1,nodes,chain,future`**（四者全開）。`scope` 有值時僅搜列舉者；未知 token → 既有 `400 invalid_scope`。本版 **不**提供 `future_hot`／`future_later` 拆分 scope |
| 6 | Search 回應 | 當 `future` ∈ scope：回應含 **`future_sight`** 陣列（無命中 → `[]`）。每筆至少：`id`、`zone`（`hot`\|`later`）、命中用的正文／摘要欄（見 seek-future-sight）。排序：先 hot 再 later；同區內近→遠（與 GET future-sight 同精神） |
| 7 | Ask 預設可讀範圍 | short-term、nodes、chain、**`memories/future-sight/hot.md`**。**預設不可讀** `later.md`。廢除 0.17 起 prompt「Do not read future-sight」之總禁 |
| 8 | Ask flag | `POST /memories/ask` body 增可選布林 **`include_later`**。省略或 `false` → 不讀 later；`true` → 允許／要求 agent 讀 `later.md`。非布林 → `400`（明確 error 碼，見 seek-future-sight）。**不做**「第一段找不到再自動讀 later」 |
| 9 | Ask prompt | 依 job 的 `include_later` 寫明可讀路徑；`include_later=false` 時 **明確禁止**讀 `later.md`（可讀 hot）。蒐證規則：未來日程／檔期類問題仍須對照 **已允許的** 未來視檔，並與 short-term／L2／chain 合成（不可只靠猜） |
| 10 | Ask sources | 允許 `sources[].kind` 含未來視（建議 wire：`future_sight`，並帶 `id`＋`zone`）；出貨時同步 api-docs／prompt 範例。舊 `L1`／`L2`／`chain` 保留 |
| 11 | 為何不問句路由 zone | 自然語言（如「XX 正式版什麼時候出」）**無法**可靠判斷答案在過去記憶、hot 或 later；故 **不**用模型／server 依問句自動決定是否讀 later，改由 **使用者 flag**（Ask）或 **Search 全掃兩區** |
| 12 | UI | Seek：**Search** scopes 增加 `future`（預設勾選，與其他預設 scope 一致）。**Ask** 提供「含較遠未來視／later」控制，綁 `include_later`（預設 off）。文案須讓人懂是 later，不是含糊「深度搜尋」 |
| 13 | GET `/memories/future-sight` | **行為不變**（仍可瀏覽兩區）；本版不倚它取代 Seek |
| 14 | 寫入／dream | Extract 准入仍用**有效** `window_days`（新預設 365 使一年內可進 later）。超出 window 仍不進未來視（走 node／chain）。本版不改 maintain／approve 流程 |
| 15 | Migration | **無**磁碟結構 migrate；**不要求**改已有 store 的 `store_version`。文件註明：缺 `future_sight_window_days` 鍵的 store 啟動後有效窗變 365；若要維持 90 須在 workspace（或 env）顯式設定 |
| 16 | 人審／auth／embedding | 不涉及 |

---

## 非目標

- Ask **兩段式**（先 memory／node／hot，找不到再 later）
- Ask **預設**每次都讀 later（無 flag 強制全讀）
- Search 的 later 專用 flag，或 `future_hot`／`future_later` scope 拆分
- 依問句自動分類／路由 hot vs later
- 改 hot／later 檔格式、入夢前 maintain、mindzone 獨立層
- Node merge、embedding、auth、日曆／提醒、遠端 sync
- 複雜未來視看板；Memory 場景大改（Seek 足夠）
- 強制把既有 workspace 的 `90` 改寫成 `365`

---

## 實作軌道（須全過；順序建議如下）

### Track 0 — 契約錨點

- **做：** 實作中若微調 error 碼、`future_sight` hit 欄位名、sources kind，先改本版 `docs/seek-future-sight.md` 再改碼。
- **不做：** 發明兩段式 Ask；把 Search later 做成獨立 flag。
- **驗收：** 新 agent 只讀 1–3 能說出：window 預設 365、Search `future`＝兩區、Ask `include_later` 預設 false。

### Track 1 — Config 預設 365

- **做：** `DEFAULT_FUTURE_SIGHT_WINDOW_DAYS = 365`；測試／文件／status 展示之「預設」敘述同步；確認 workspace 已設 90 時有效值仍為 90。
- **不做：** migrate 改寫既有 yaml；改 `hot_days` 預設。
- **驗收：** 無該鍵 → 有效 365；有鍵 90 → 有效 90；非法值仍拒啟。

### Track 2 — Search 納入 future

- **做：** `SEARCH_SCOPES` 加 `future`；預設四 scope；實作掃兩檔 item 關鍵字；API＋`test:phases`（或等價）。
- **不做：** later-only flag；改 GET future-sight。
- **驗收：** 省略 scope 可命中 later 內文；`scope=nodes` 不含 `future_sight` 鍵（或等價：不搜未來視）；`scope=future` 可回 hot 與 later 命中且帶 `zone`。

### Track 3 — Ask `include_later`＋prompt

- **做：** POST body 解析 `include_later`；傳入 job／runner／prompt；更新 `memory-ask.md`（及 mock）；sources 契約；busy／cancel 行為不變。
- **不做：** 自動兩段；預設讀 later。
- **驗收：** 預設 job prompt／指示不可讀 later；`include_later:true` 可读 later；非法型別 400；mock 或 phase 可區分兩模式。

### Track 4 — Seek UI

- **做：** Search scope 勾選 `future`（預設 on）；Ask 控制綁 `include_later`（預設 off）；i18n；命中列展示 zone。
- **不做：** Memory 場景重做；未來視拖曳看板。
- **驗收：** UI 預設行為與 API 預設一致；手動開關後 request 帶正確欄位。

### Track 5 — 出貨

- **做：** `version.md`／`changelog.md`；`docs/api-docs/`、`domain-language`、`CLAUDE.md`、workbench skill；刪除或清空 backlog 之 recall 條（出貨時）；INDEX → `shipped`。
- **驗收：** 總表全勾。

---

## 驗收總表

- [x] 有效 `future_sight_window_days`：缺鍵預設 **365**；workspace／env 顯式值優先
- [x] `hot_days` 預設仍 30；分桶／maintain／approve 行為與 0.17 等價（僅窗長預設變）
- [x] Search：`future` scope；預設含 future；掃 **hot＋later**；回應含 `zone`
- [x] Search：**無** later 專用 flag
- [x] Ask：預設可讀 hot、**不可**讀 later；`include_later:true` 可讀 later
- [x] Ask：**無**兩段式自動升級讀 later
- [x] Prompt／api-docs／UI／CLAUDE／workbench 已同步
- [x] `test:phases`（或等價）覆蓋 search future 命中與 ask flag 兩態
- [x] backlog recall 條出貨後移除；version／changelog 更新；INDEX＝`shipped`

---

## 錨點檔案（改前必讀）

| 路徑 | 角色 |
|------|------|
| `server/src/config.ts` | `DEFAULT_FUTURE_SIGHT_WINDOW_DAYS` |
| `server/src/seek/search.ts` | scope 與 keyword 搜尋 |
| `server/src/api/seek/search.ts` | GET search HTTP |
| `server/src/api/seek/ask.ts`、`server/src/seek/ask-run.ts` | Ask POST／job |
| `server/src/agent/ask-invoke.ts`、`ask-*.ts` | prompt 注入 |
| `server/prompts/memory-ask.md` | 現禁讀 future-sight；本版改 |
| `server/src/store/memories/future-sight.ts` | 讀兩檔／list items（供 search 複用） |
| `server/src/cli/self-test.ts` | phases |
| `web/src/scenes/SeekScene.tsx` | Seek UI |
| `docs/api-docs/api.md`、`docs/domain-language.md` | 出貨同步 |
| `.claude/skills/engram-workbench/SKILL.md` | 操作語意 |

---

## 開工前仍須拍板

（無。）
