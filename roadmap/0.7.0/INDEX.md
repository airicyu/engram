# 0.7.0 — Memory + Ask + Dream Cancel

← [changelog](../../changelog.md) · 上游：[0.6.0](../0.6.0/INDEX.md) · current: [version](../../version.md) · 詞彙：[domain-language.md](../../domain-language.md)

> **狀態：** 已出貨（`version.md` **0.7.0**）。  
> **本版做：** **Memory** 域（Search + `scope`、Ask + 手動 cancel）；**入夢手動 cancel**；Capture **`GET /memory/l1`**。  
> **本版不做：** embedding／多輪 Ask session、future-sight UI、auto timeout、改 stale lock。

## 產品句

> **記憶**：搜尋（快）或提問（AI）。**沉澱**：入夢中可取消。卡住時使用者／agent **手動 cancel**，不做自動 timeout。

## 文件地圖

| 文件 | 內容 |
|------|------|
| [docs/memory-ask.md](./docs/memory-ask.md) | Search／L1／Ask API、Ask cancel |
| [docs/dream-cancel.md](./docs/dream-cancel.md) | 入夢 cancel（= revert running run） |
| [domain-language.md](../../domain-language.md) | Memory／Search／Ask 產品詞 |

## 已定案

### Memory 域

| 端點 | 用途 |
|------|------|
| `GET /memory/l1` | Capture L1 預覽 |
| `GET /memory/search?q=&scope=` | keyword 搜尋（`q` 必填；`scope=l1,nodes,chain` 可選，預設全搜；只回命中） |
| `POST /memory/ask` | 非同步 AI 問答 |
| `GET /memory/ask/{job_id}` | 輪詢 |
| `POST /memory/ask/{job_id}/cancel` | 手動取消 ask |

Ask：agent 直讀 `ENGRAM_HOME`；同時只一個 running ask（`409 ask_busy`）。

### Dream cancel

| 端點 | 用途 |
|------|------|
| `POST /dream/cancel` | running 入夢：kill agent + revert L1.5 半成品 + release lock |

與 **Discard** 分工：cancel = running；discard = pending_review（已有）。**不支援 resume**。

### Cancel 共用基礎設施

- `store/agent-process.ts` — in-memory `proc` + `agent_pid`
- `agent_spawn` 寫 PID（ask `job.yaml`、dream `dream-job.yaml`）
- **手動 only** — 無 `ENGRAM_*_TIMEOUT_MS` auto

## 非目標

- 向量檢索、Ask 多輪、future-sight Memory UI
- Ask／Dream **自動 timeout**
- 改 dream **stale lock**（30 分鐘被動拆鎖維持現狀）
- `GET /recall` 別名

## 實作軌道

1. **`store/agent-process.ts`** — 共用 proc registry + PID kill
2. **Memory 域** — `/memory/l1`、`/memory/search`；移除 `/recall`
3. **Ask** — job store、runner、ask API + cancel、Web Memory tab
4. **Dream cancel** — `POST /dream/cancel`、`abandonDreamRun`、materialize `AbortSignal`、`agent_pid` on extract、Consolidate 取消鈕
5. **docs** — `api-docs`、workbench skill、`test:phases`

## 與 0.6.0

複製 events／progress UI 模式；0.6.0 已出貨。

---

**狀態：** shipped — 見 `version.md` 0.7.0

**下游：** [0.8.0 Seek + Memory Browse](../0.8.0/INDEX.md)（plan）
