# Engram

個人記憶原型：把日常碎片寫進來，用 AI「做夢」整理成**可審核**的長期理解，需要時再找回來。

它不是筆記 app，也不是聊天備份。核心是一條有人在迴路裡的記憶管線：

```
Activities → Consolidate → Seek → Memory
   寫入         沉澱／入夢      尋找         翻閱
```

**目前版本：** [0.16.0](./version.md) · 變更見 [changelog.md](./changelog.md) · 使用前請讀 [DISCLAIMER.md](./DISCLAIMER.md)

> **讀文件時：** 這份 README 是給人看的專案說明。給 AI coding agent 的操作邊界與開發脈絡在 [CLAUDE.md](./CLAUDE.md)（Cursor／Claude Code 會自動讀取），請勿把兩者當成同一份文件。

---

## 為什麼做這個

人會持續產生碎片（對話、判斷、待辦線索），卻很少有一次整理成「穩定理解」的習慣。Engram 刻意拆成四步：

1. **先寫下來**（Activities）— 不要求當下分類完美。
2. **再沉澱**（Consolidate）— AI 提出整合方案；**你批准後**才寫進長期記憶。
3. **需要時問／搜**（Seek）— 自然語言 Ask，或關鍵字 Search。
4. **沿時間與主題翻**（Memory）— 記憶鏈與節點瀏覽。

設計上分開存放：**事件紀錄 ≠ 短期工作區 ≠ 長期理解**；中間還有「待審提案」，避免 AI 直接改寫你的記憶。

詞彙與分層細節：[docs/domain-language.md](./docs/domain-language.md)。

---

## 快速開始

### 前置需求

| 需要 | 說明 |
|------|------|
| [Bun](https://bun.sh) | 跑 API／UI／setup |
| **Git** | 0.16+：每個記憶庫（`ENGRAM_STORE_DIR`）是 local git repo；無 git 則 server 拒絕啟動 |
| **本機已登入可用的 agent CLI** | Dream、rollup、Seek Ask 都會呼叫它。二選一： **[Cursor CLI](https://cursor.com/docs/cli/overview)**（`agent`，預設）或 **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)**（`claude`） |

可選環境變數：`ENGRAM_TEMP_DIR`（預設 `/tmp`）— ask jobs 與 dream agent 暫存根目錄（不在記憶庫內）。


setup 時可選用哪個 agent；也可用環境變數 `ENGRAM_AGENT=claude`｜`cursor`（預設 **claude**；見 [server/README.md](./server/README.md)）。僅跑 UI／讀既有記憶時可不叫 agent；**入夢與 Ask 沒有可用的 CLI 會失敗**。

### 1. 首次設定

會安裝依賴、寫出 `.env`、選定**記憶庫**路徑與時區／寫入語言：

```bash
bun run setup
```

### 2. 啟動

兩個終端（或兩個程序）：

```bash
bun run dev      # API  http://localhost:8787
bun run dev:ui   # UI   http://localhost:8788
```

瀏覽器打開 **http://localhost:8788** ，從頂欄場景走一遍即可。

| 場景 | 你在做什麼 |
|------|------------|
| **Activities** | 寫下此刻要記住的事；下方可預覽短期記憶 |
| **Consolidate** | 入夢產出報告 → 批准／丟棄／帶理由重試 |
| **Seek** | 預設 **Ask**（自然語言）；也可切 **Search**（關鍵字） |
| **Memory** | 沿記憶鏈／節點翻閱已寫入內容 |

### 3. 清空重來（可選）

會清空記憶庫，不可還原：

```bash
cd server && bun run reset
```

---

## 倉庫地圖

| 路徑 | 給誰看 | 內容 |
|------|--------|------|
| [web/](./web/) | 用產品／改 UI | 工作台（Vite + React） |
| [server/](./server/) | 改記憶核心 | Bun HTTP API |
| [setup-wizard/](./setup-wizard/) | 首次安裝 | `bun run setup` |
| [docs/api-docs/](./docs/api-docs/) | 接 API／除錯 | HTTP 契約 |
| [docs/roadmap/](./docs/roadmap/) | 規劃與設計 | 版本計畫、驗收、推理筆記 |
| [docs/domain-language.md](./docs/domain-language.md) | 對齊用詞 | 產品領域詞彙 |
| [CLAUDE.md](./CLAUDE.md) | **AI agent** | 自動注入的開發脈絡（非產品說明） |

**記憶庫**（你的資料）由環境變數 `ENGRAM_STORE_DIR` 指向；setup 時可選路徑（常見為旁鄰的 `engram-data/`，或 repo 內預設 `data/`）。那是執行期資料，不是原始碼。

---

## 想再深入

- HTTP 契約：[docs/api-docs/README.md](./docs/api-docs/README.md) · [docs/api-docs/api.md](./docs/api-docs/api.md)
- 元件說明：[server/README.md](./server/README.md) · [web/README.md](./web/README.md)
- 本版重點：[docs/roadmap/0.16.0/](./docs/roadmap/0.16.0/) · [changelog.md](./changelog.md)
- 尚未排程：[docs/roadmap/backlog/](./docs/roadmap/backlog/)

**原型現況：** 無帳號／多租戶；部分能力（例如 node merge）尚無正式 API。日常請用 UI 或 HTTP API 操作記憶，不要手改記憶庫裡的檔案。

---

## 授權與免責

- 授權：[LICENSE](./LICENSE)（MIT）
- 使用風險與限制：[DISCLAIMER.md](./DISCLAIMER.md)
