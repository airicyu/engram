# Engram 設定（env ＋ workspace）

← [README](../README.md) · [CLAUDE.md](../CLAUDE.md) · [API](./api-docs/README.md) · [domain-language](./domain-language.md)

Engram 設定分兩層：**進程／本機**（`server/.env` 或環境變數）與 **跟著記憶庫**（`{ENGRAM_STORE_DIR}/engram.workspace.yaml`）。  
實作真相：`server/src/config.ts`；範例：`server/.env.example`。

---

## 兩層怎麼分

| 層 | 放哪 | 跟著什麼走 | 典型內容 |
|----|------|------------|----------|
| **Env** | `server/.env`（`cd server && bun run …` 時 Bun 自動載入）或 shell 環境變數 | **這台機器／這個進程** | 記憶庫路徑、埠、agent CLI、暫存目錄、除錯開關 |
| **Workspace** | `{ENGRAM_STORE_DIR}/engram.workspace.yaml` | **這份記憶庫**（可隨庫搬移／git 追蹤） | 時區、寫入語言、store 世代、未來視窗長 |

**不要**把埠、`ENGRAM_AGENT`、binary 路徑寫進 workspace yaml——未知鍵會**拒啟**。

首次可用 repo 根目錄 `bun run setup` 產生 `server/.env` 與 workspace 檔。

---

## 重疊鍵的優先序（強制）

對 **timezone／memory_language／future_sight_*_days** 這類「兩邊都能設」的值：

1. **workspace yaml 若存在該鍵** → 用 yaml 的值  
2. 否則 → **對應 env**（若有設）  
3. 否則 → **程式預設**

重點：**env 不會蓋過 workspace 已寫的鍵。**  
例：yaml 寫了 `future_sight_window_days: 90`，即使 env 設 `ENGRAM_FUTURE_SIGHT_WINDOW_DAYS=365`，有效值仍是 **90**。

非法值（非法 IANA、非法語言、非正整數窗長、未知 yaml 鍵等）→ **啟動失敗**（印錯誤後 exit）。

有效值可在 `GET /status` 看到（如 `timezone`、`memory_language`、`future_sight_window_days`、`future_sight_hot_days`、`store_version`、`temp_dir`）。

---

## Env（`server/.env`）

皆可選；省略則用下表預設。鍵名大小寫依表（慣例全大寫）。

### 路徑與進程

| 變數 | 預設 | 說明 |
|------|------|------|
| `ENGRAM_STORE_DIR` | `<repo>/data` | 記憶庫根目錄（絕對或相對 cwd）。領域名是 **memory store／記憶庫**，不是本鍵名 |
| `ENGRAM_TEMP_DIR` | `/tmp` | Ask job 與 dream agent 暫存根目錄（**不在**記憶庫內） |
| `PORT` | `8787` | HTTP 埠；**固定綁 `127.0.0.1`**（僅本機） |

### Agent

| 變數 | 預設 | 說明 |
|------|------|------|
| `ENGRAM_AGENT` | `claude` | `claude`｜`cursor`｜`mock-ok`｜`mock-fail`｜`mock-ask-ok`。Dream／Ask（及相關 runner）用此選擇 CLI |
| `CLAUDE_BIN` | `claude` | Claude Code 可執行檔（`ENGRAM_AGENT=claude` 時） |
| `CURSOR_AGENT_BIN` | `agent` | Cursor CLI 可執行檔（`ENGRAM_AGENT=cursor` 時） |

### 除錯與實驗開關

| 變數 | 預設 | 說明 |
|------|------|------|
| `ENGRAM_DREAM_DEBUG` | off | 設 `1` → 入夢 extract／apply 詳細 log |
| `ENGRAM_ALLOW_VIRTUAL_CLOCK` | off | 設 `1` → 允許 `PUT /clock`（時間重播）。`DELETE /clock` 恆可 |

### 可與 workspace 重疊的 env（僅在 yaml **未寫該鍵**時生效）

| 變數 | 預設 | 對應 workspace 鍵 |
|------|------|-------------------|
| `ENGRAM_TZ` | `Asia/Hong_Kong` | `timezone` |
| `ENGRAM_MEMORY_LANGUAGE` | `en` | `memory_language`（僅 `zh-Hant`｜`zh-Hans`｜`en`） |
| `ENGRAM_FUTURE_SIGHT_WINDOW_DAYS` | `365` | `future_sight_window_days`（正整數） |
| `ENGRAM_FUTURE_SIGHT_HOT_DAYS` | `30` | `future_sight_hot_days`（正整數） |

Web UI 另有 `web/.env`（如 `WEB_PORT`、`ENGRAM_URL` proxy），**不**由此檔規範；見 `web/` 與 setup wizard。

---

## Workspace（`engram.workspace.yaml`）

路徑：`{ENGRAM_STORE_DIR}/engram.workspace.yaml`。  
**只允許**下列鍵；多寫任何其他鍵 → 拒啟。檔案可不存在（全走 env／預設）。

| 鍵 | 型別 | 缺鍵時 | 說明 |
|----|------|--------|------|
| `timezone` | IANA 字串 | → `ENGRAM_TZ` → `Asia/Hong_Kong` | 日曆日、事件時間戳所用時區 |
| `memory_language` | `zh-Hant`｜`zh-Hans`｜`en` | → `ENGRAM_MEMORY_LANGUAGE` → `en` | **新**寫入的 chain／node／ask 等散文語言（不是 L0 `raw`，也不是 UI i18n） |
| `store_version` | semver `X.Y.Z` | 可缺；`GET /status.store_version` 為 `null` | **結構世代**標記（亦可因新建 stamp 成當下產品版，即使該版未改盤）。migrate 按結構代／逐代 hop，見 [store-version](./roadmap/0.16.0/docs/store-version.md) 與 [engram-migration](../.claude/skills/engram-migration/SKILL.md) |
| `future_sight_window_days` | 正整數 | → env → **365** | 未來視**准入上限**（從入夢日 `T` 起算天數） |
| `future_sight_hot_days` | 正整數 | → env → **30** | 熱區（hot）天數。不強制 `hot_days < window_days` |

### 範例

```yaml
timezone: Asia/Hong_Kong
memory_language: zh-Hant
store_version: 0.17.0
# 可選：要維持 90 日窗而非 0.18 預設 365 時再寫
# future_sight_window_days: 90
# future_sight_hot_days: 30
```

0.18 起：缺 `future_sight_window_days` 時有效窗為 **365**。若升級程式後仍要 90 日，須在 yaml（或 env）**顯式**設定。詳見 [0.18.0](./roadmap/0.18.0/INDEX.md)。

---

## 對照速查

| 想改什麼 | 建議寫在 |
|----------|----------|
| 記憶庫在哪個目錄 | env `ENGRAM_STORE_DIR` |
| HTTP 埠、agent 選誰、binary、虛擬時鐘、dream debug | env only |
| Ask／dream 暫存目錄 | env `ENGRAM_TEMP_DIR` |
| 這份庫用什麼時區／寫入語言 | **優先** workspace；本機暫覆寫才用 env |
| 未來視窗長／hot 天數 | **優先** workspace；否則 env；否則 365／30 |
| 庫結構世代 | workspace `store_version` only |

---

## 相關

- 環境變數範例：[`server/.env.example`](../server/.env.example)
- Server README 環境表：[`server/README.md`](../server/README.md)
- Status／API 欄位：[`docs/api-docs/api.md`](./api-docs/api.md)
- 未來視雙區語意：[`docs/roadmap/0.17.0/docs/store-and-zones.md`](./roadmap/0.17.0/docs/store-and-zones.md)
