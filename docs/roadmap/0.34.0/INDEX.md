# 0.34.0 — Ask 廢 `include_later`：永遠可讀 later

← [changelog](../../../changelog.md) · 上游：[0.33.0](../0.33.0/INDEX.md)（shipped）· current: [version](../../../version.md) · 寫法：[GUIDELINES.md](../GUIDELINES.md) · 節奏：[agent-workflow.md](../agent-workflow.md)

> **狀態：** **shipped**  
> **本版只做這一項：** Seek **Ask** 取消「是否含較遠未來視（later）」選擇——從 **API／job／prompt／UI** 一併拿掉 `include_later`。每次 Ask 的 agent **都可讀** `hot.md` 與 `later.md`，由模型依問題判斷要不要用 later。**不**改 Search、future-sight 存法／分桶、dream。**無** store migrate；**不**抬 boot gate。

## 產品句

> 人在 Seek 提問時不必勾選 later；Ask 一律把較遠未來視納入可讀範圍，由 AI 決定查什麼。

## 文件地圖（讀完即可開工）

| # | 文件 | 內容 |
|---|------|------|
| 1 | **本檔 INDEX** | 範圍、定案、非目標、驗收 |
| 2 | [docs/reasoning.md](./docs/reasoning.md) | 為何推翻 0.18 的使用者旗標 |

---

## 問題（本版要解決什麼）

1. Ask 要使用者決定「這題要不要讀 later」——問句形態分不出落點，人也不該當閘門。
2. 勾選增加 workflow 摩擦；漏勾就漏掉一年窗內的較遠錨點。
3. 未來視文本量小、不細，token 成本不再構成預設關閉 later 的理由。

---

## 已定案

| # | 題 | 決定 |
|---|-----|------|
| 1 | 讀取範圍 | 每個 Ask job **一律可讀** `memories/future-sight/hot.md` **與** `later.md`。Prompt 兩檔都列在 store map。 |
| 2 | 誰決定查什麼 | **Agent** 依問題判斷要不要開 later、引用哪些錨點。Server **不**依問句分類 zone、**不**做兩段式（先答再偷偷開 later）。日程／檔期類問題應在**同一蒐證輪**對照已允許的未來視檔，再與 short-term／L2／chain 合成。 |
| 3 | 不必每次都讀 later | 問題明顯與未來計畫無關時，agent **可跳過** later；**不要**把 later 全檔倒進答案。 |
| 4 | 廢 API 欄 | `POST /memories/ask` body **僅** `q`。若出現 **`include_later` 鍵**（不論值、含 `true`／`false`／字串）→ **400** `include_later_removed`（message 說明 later 已恆可讀、勿再傳此欄）。廢 `invalid_include_later`。 |
| 5 | Job／回應 | `202`、`GET /memories/ask/{job_id}`、job.yaml、ask events **不再**寫或 echo `include_later`。舊 temp job 若仍有該鍵：GET **省略**（不回傳）。`/status.ask_job` 本就未 echo 此欄，維持。 |
| 6 | UI | Seek Ask **移除**「含較遠未來視（later）」勾選；`useAskJob.start(q)` 只傳 `{ q }`。導語不再提須另行勾選 later。 |
| 7 | Search | **不變**：`scope=future` 仍掃 hot＋later；無 later 專用 flag。 |
| 8 | Store／dream | **不變**：hot／later 兩檔、入夢前重桶、GET 懶清過期、window／hot_days 預設皆不變。 |
| 9 | Migrate | **無**；boot gate 仍 ≥0.28。 |

---

## 非目標

- 合併 `hot.md`／`later.md`、改分桶或 window
- Search 另開 later flag，或 Ask 兩段式自動升級
- Server 依問句 NLP 路由 zone
- Dream／clarify／activities 行為
- 抬 boot gate、store migrate hop

---

## 錨點檔案（改前必讀）

| 路徑 | 用途 |
|------|------|
| `server/src/api/seek/ask.ts` | POST body 解析 `include_later` |
| `server/src/seek/ask-run.ts` | job 編排把 flag 傳入 runner |
| `server/src/store/tmp/ask-job.ts` | job.yaml 欄位 |
| `server/src/agent/ask/types.ts`、`build-prompt.ts`、`mock.ts` | AskInput／prompt／mock |
| `server/prompts/memory-ask.md` | agent 指示 |
| `web/src/scenes/SeekScene.tsx`、`web/src/hooks/useAskJob.ts`、`web/src/lib/api.ts` | 勾選與 client |
| `server/src/cli/self-test.ts` Phase 4b | 帶 `include_later` → 400；僅 `q` → 可引用 later |
| `docs/api-docs/api.md`、`AGENTS.md`、`docs/domain-language.md`、`.agents/skills/engram-workbench/` | 契約與操作說明 |

---

## 驗收

- [x] `POST /memories/ask` `{ q }` → 202；body／poll **無** `include_later`
- [x] 帶 `include_later`（true／false／非布林）→ 400 `include_later_removed`
- [x] mock／phase：預設 job 可引用 later zone；prompt 兩檔都在 map、無「禁止讀 later」
- [x] Seek Ask 無 later 勾選；只送 `{ q }`
- [x] Search `future` 行為不變
- [x] `version.md`／`changelog.md`／契約／skill／AGENTS＝0.34.0；**無** migrate

---

## 與相鄰版本

| | 0.18.0 | 0.33.0 | **0.34.0** |
|--|--------|--------|------------|
| 焦點 | Seek 讀未來視；Ask `include_later` | Workbench UI | **廢 Ask `include_later`** |
| Ask later | 預設禁；旗標才開 | 不變 | **恆可讀；人／API 不再選** |
| migrate | 無 | 無 | **無** |
