# Engram

**Engram** 是個人記憶原型：把日常片段寫進來，定期用 AI「做夢」整理成可審核的長期理解，需要時再回憶相關脈絡。

它不是筆記 app，也不是聊天紀錄備份，而是一條明確的記憶管線：

```
Capture（記下）→ Consolidate（沉澱）→ Recall（回憶）
```

目前版本：**0.5.0**（見 [version.md](./version.md)、[changelog.md](./changelog.md)）。

---

## 這個產品解決什麼

人會持續產生碎片資訊（對話、判斷、待辦線索），但很少有一次整理成「穩定理解」的習慣。Engram 把這件事拆成三步：

1. **快速 Capture** — 先記下來，不要求當下分類完美。
2. **Consolidate with review** — AI 提出整合方案（報告 + 結構化 patch），**你批准後**才寫入長期記憶。
3. **Recall** — 用關鍵字拉回 L1 視圖、日級時間軸、相關 node 理解。

核心設計選擇：**人審關卡**、**分層儲存**（事件 log ≠ 工作記憶 ≠ 長期理解）、**可追蹤的入夢中間態**（L1.5）。

---

## 記憶分層（簡表）

| 層 | 角色 | 一句話 |
|----|------|--------|
| **L0** | 事件 log | 發生了什麼（不可改） |
| **L1** | 短期 pool | 還沒整理完的輸入 |
| **L1.5** | 入夢中間態 | AI 提案 + 待審 draft（L1 → L2） |
| **L2** | Node 理解 | 對人／主題的長期「what」 |
| **chain** | 日級時間軸 | **ledger**（增量稽核）＋ **summary**（可讀日摘要；Recall 預設） |
| **future-sight** | 近程錨點 | 短期要盯的 deadline／前瞻 |

術語細解見 **[domain-language.md](./domain-language.md)**。

---

## 怎麼跑起來

需要 [Bun](https://bun.sh)。

**1. 啟動 API（`:8787`）**

```bash
cd server
bun install
bun run start
```

**2. 啟動 Web UI（`:8788`，可選）**

```bash
cd web
bun install
bun run start
```

瀏覽器開 **http://localhost:8788**。根目錄也可用：

```bash
bun run dev      # server
bun run dev:ui   # web
```

**3. 典型操作**

- **Capture** — 在 UI 或 `POST /capture` 寫入 `raw` 文字。
- **Consolidate** — `POST /dream/run`，等 `pending_review`，讀報告後 **Approve** 或 **Discard**。
- **Recall** — `GET /recall?q=關鍵字` 看 context packet。

空庫試用請用 `cd server && bun run reset`（破壞性，會清空 `ENGRAM_HOME`）。  
真人試用請用空 store + capture；機械自測用 `cd server && bun run test:phases`。

---

## 倉庫結構

| 路徑 | 說明 |
|------|------|
| [server/](./server/) | Bun HTTP API（記憶核心） |
| [web/](./web/) | 工作台 UI（workbench）+ `/api` proxy |
| [api-docs/](./api-docs/) | API 說明；契約見 [api-docs/api.md](./api-docs/api.md) |
| [data/](./data/) | 預設 `ENGRAM_HOME`（執行期 store） |
| [roadmap/](./roadmap/) | 版本計畫與設計筆記 |
| [domain-language.md](./domain-language.md) | 產品領域詞彙表 |
| [AGENTS.md](./AGENTS.md) | 給 coding agent 的專案脈絡 |

---

## API 一覽

| 方法 | 路徑 | 用途 |
|------|------|------|
| `POST` | `/capture` | 寫入 L0 + L1 |
| `POST` | `/dream/run` | 啟動 dream（extract → draft） |
| `GET` | `/dream/pending` | 讀待審報告 |
| `POST` | `/dream/approve` | 批准並 commit |
| `POST` | `/dream/discard` | 丟棄待審 |
| `GET` | `/recall` | 回憶 context packet |
| `GET` | `/future-sight` | 列出活躍前瞻錨點 |
| `GET` | `/status` | 健康與 dream 狀態 |

時區由 **`ENGRAM_TZ`** 設定（IANA），預設 **`Asia/Hong_Kong`**。原型無 auth。

---

## 邊界與現況

- **操作記憶請走 HTTP API**，不要手改 `data/` 下的 jsonl／md（除開發除錯）。
- **Recall 目前不注入 future-sight**（0.4.0）；見 [roadmap/backlog/](./roadmap/backlog/)。
- DLQ 消化、node merge 等尚未有正式 API。

---

## 授權

見 [LICENSE](./LICENSE)。
