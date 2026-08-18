# Engram 設定（env ＋ workspace）

← [README](../README.md) · [AGENTS.md](../AGENTS.md) · [API](./api-docs/README.md) · [domain-language](./domain-language.md)

Engram 設定分兩層：**進程／本機**（repo 根目錄 `.env` 或環境變數）與 **跟著記憶庫**（`{ENGRAM_STORE_DIR}/engram.workspace.yaml`）。  
實作真相：`server/src/config.ts`（啟動時讀 repo 根 `.env`）；範例：[`.env.example`](../.env.example)。

**0.21+：** 除 `ENGRAM_STORE_DIR`（必須在讀 yaml 前知道路徑）外，**所有設定鍵皆可在 env 或 workspace 任一侧設定**；優先序見下。

---

## 兩層怎麼分

| 層 | 放哪 | 跟著什麼走 | 典型內容 |
|----|------|------------|----------|
| **Env** | repo 根 `.env`（server／web 共用；已設的 process env 不覆寫） | **這台機器／這個進程** | 記憶庫路徑（僅 env）、本機埠覆寫、除錯開關、`WEB_PORT`／`ENGRAM_URL` |
| **Workspace** | `{ENGRAM_STORE_DIR}/engram.workspace.yaml` | **這份記憶庫**（可隨庫搬移／git 追蹤） | 時區、寫入語言、agent 選擇、dream cleanup、未來視窗 |

首次可用 repo 根目錄 `bun run setup` 產生 `.env` 與 workspace 檔。

---

## 優先序（強制）

對所有「兩邊都能設」的值：

1. **workspace yaml 若存在該鍵** → 用 yaml 的值  
2. 否則 → **對應 env**（若有設）  
3. 否則 → **程式預設**

重點：**env 不會蓋過 workspace 已寫的鍵。**  
例：yaml 寫了 `agent: cursor`，即使 env 設 `ENGRAM_AGENT=claude`，有效值仍是 **cursor**。

非法值（非法 IANA、非法語言、非正整數、未知 yaml 鍵等）→ **啟動失敗**（印錯誤後 exit）。

有效值可在 `GET /status` 看到（如 `timezone`、`memory_language`、`temp_dir`、`dream_cleanup` 等）。

---

## 僅 env（bootstrap）

| 變數 | 預設 | 說明 |
|------|------|------|
| `ENGRAM_STORE_DIR` | `<repo>/data` | 記憶庫根目錄。須在載入 workspace 前設定，**不可**寫進 yaml |

---

## 雙邊皆可設（env ↔ workspace 鍵）

皆可選；省略則用下表預設。workspace 鍵名為 **snake_case**。

### 路徑與進程

| workspace 鍵 | env | 預設 | 說明 |
|--------------|-----|------|------|
| `temp_dir` | `ENGRAM_TEMP_DIR` | `/tmp` | Ask job 與 dream agent 暫存根目錄（**不在**記憶庫內） |
| `port` | `PORT` | `8787` | HTTP 埠；**固定綁 `127.0.0.1`**（僅本機） |

### Agent

| workspace 鍵 | env | 預設 | 說明 |
|--------------|-----|------|------|
| `agent` | `ENGRAM_AGENT` | `claude` | `claude`｜`cursor`｜`codex`｜`mock-*`（Dream／Ask／Rollup runner） |
| `claude_bin` | `CLAUDE_BIN` | `claude` | Claude Code 可執行檔 |
| `cursor_agent_bin` | `CURSOR_AGENT_BIN` | `agent` | Cursor CLI 可執行檔 |
| `cursor_sandbox` | `ENGRAM_CURSOR_SANDBOX` | `disabled` | `enabled`｜`disabled`（Cursor `--sandbox`） |
| `codex_bin` | `CODEX_BIN` | `codex` | Codex CLI 可執行檔 |

### 記憶庫語意

| workspace 鍵 | env | 預設 | 說明 |
|--------------|-----|------|------|
| `timezone` | `ENGRAM_TZ` | `Asia/Hong_Kong` | IANA 時區（日曆日、事件時間戳） |
| `memory_language` | `ENGRAM_MEMORY_LANGUAGE` | `en` | `zh-Hant`｜`zh-Hans`｜`en`（新寫入 chain／node／ask 散文；`zh-Hant`＝繁體中文書面語） |
| `future_sight_window_days` | `ENGRAM_FUTURE_SIGHT_WINDOW_DAYS` | `365` | 未來視准入上限（天） |
| `future_sight_hot_days` | `ENGRAM_FUTURE_SIGHT_HOT_DAYS` | `30` | 未來視 hot 區天數 |

### 除錯與實驗

| workspace 鍵 | env | 預設 | 說明 |
|--------------|-----|------|------|
| `dream_debug` | `ENGRAM_DREAM_DEBUG` | `false` | 入夢 extract／apply 詳細 log |
| `memory_debug` | `ENGRAM_MEMORY_DEBUG` | `false` | memory search／ask 詳細 log |
| `allow_virtual_clock` | `ENGRAM_ALLOW_VIRTUAL_CLOCK` | `false` | 允許 `PUT /clock`（時間重播）。`DELETE /clock` 恆可 |
| `allow_stale_store` | `ENGRAM_ALLOW_STALE_STORE` | `false` | 結構過舊時警告後仍啟動（預設拒啟） |

### Dream cleanup／scheduler（0.21+）

| workspace 鍵 | env | 預設 | 說明 |
|--------------|-----|------|------|
| `dream_staging_retention_days` | `ENGRAM_DREAM_STAGING_RETENTION_DAYS` | `3` | staging TTL；`0`＝僅 recovery |
| `dream_committed_report_retention_days` | `ENGRAM_DREAM_COMMITTED_REPORT_RETENTION_DAYS` | `7` | committed report TTL；`-1`＝永久 |
| `dream_cleanup_min_age_days` | `ENGRAM_DREAM_CLEANUP_MIN_AGE_DAYS` | `1` | TTL 刪除最小齡 |
| `dream_cleanup_cron` | `ENGRAM_DREAM_CLEANUP_CRON` | `0 3 * * *` | in-process cleanup cron |
| `dream_cleanup_cron_enabled` | `ENGRAM_DREAM_CLEANUP_CRON_ENABLED` | `true` | 註冊 cleanup cron |
| `dream_cleanup_on_start` | `ENGRAM_DREAM_CLEANUP_ON_START` | `true` | 啟動時 sweep |
| `auto_dream_enabled` | `ENGRAM_AUTO_DREAM_ENABLED` | `false` | 定時 auto dream |
| `auto_dream_cron` | `ENGRAM_AUTO_DREAM_CRON` | `30 3 * * *` | auto dream cron |
| `dream_auto_approve` | `ENGRAM_DREAM_AUTO_APPROVE` | `true` | 入夢／retry／amend **成功寫出 pending 後**自動 `approveDream`（deploy＋git＋清 scope）。`false`＝停在 `pending_review` 等人審。自動 approve 失敗則留下 pending |

### 附件（0.29+）

| workspace 鍵 | env | 預設 | 說明 |
|--------------|-----|------|------|
| `attachment_max_bytes` | `ENGRAM_ATTACHMENT_MAX_BYTES` | `10485760`（10 MiB） | 單檔上傳大小上限 |
| `attachment_tmp_retention_days` | `ENGRAM_ATTACHMENT_TMP_RETENTION_DAYS` | `2` | tmp 保留天數 |
| `attachment_housekeep_cron` | `ENGRAM_ATTACHMENT_HOUSEKEEP_CRON` | `30 2 * * *` | tmp housekeep cron |
| `attachment_housekeep_cron_enabled` | `ENGRAM_ATTACHMENT_HOUSEKEEP_CRON_ENABLED` | `true` | 啟用 housekeep cron |
| `attachment_housekeep_on_start` | `ENGRAM_ATTACHMENT_HOUSEKEEP_ON_START` | `true` | 啟動時清理 tmp |

env 布林值：`0`/`1`、`true`/`false`、`yes`/`no`（大小寫不敏感）。

---

## 僅 workspace

| 鍵 | 型別 | 說明 |
|----|------|------|
| `store_version` | semver `X.Y.Z` | **結構世代**標記；**0.36+ boot** 要求 major.minor ≥ **0.36**，否則拒啟。migrate 離線跑 **engram-migration** skill（`migrate-0.28-to-0.36`；更舊先 `migrate-0.19-to-0.28`；在該 skill 目錄 `bun ./scripts/…`；**無需先啟動 server**）。見 [store-version](./roadmap/0.16.0/docs/store-version.md) |

`engram.workspace.yaml` **只允許**上表所列鍵（含雙邊表中的 workspace 鍵）；多寫任何其他鍵 → 拒啟。檔案可不存在（全走 env／預設）。

### 範例

```yaml
timezone: Asia/Hong_Kong
memory_language: zh-Hant
store_version: 0.36.0
agent: cursor
port: 8787
# dream_staging_retention_days: 3
# auto_dream_enabled: false
# dream_auto_approve: true
```

---

## 對照速查

| 想改什麼 | 建議寫在 |
|----------|----------|
| 記憶庫在哪個目錄 | **僅** env `ENGRAM_STORE_DIR` |
| 跟著這份庫走的 agent、時區、語言、cleanup | **優先** workspace yaml |
| 本機暫覆寫（同一庫多機部署） | env（yaml 未寫該鍵時生效） |
| 庫結構世代 | workspace `store_version`（0.36+ 最低 **0.36**） |
| 用 Obsidian 看庫 | 開啟 **`{ENGRAM_STORE_DIR}/memories/`**（不要開 store 根） |

Web UI 的 `WEB_PORT`、`ENGRAM_URL` 也寫在**同一份**根 `.env`（不要再放 `web/.env`）。

---

## 相關

- 環境變數範例：[`.env.example`](../.env.example)
- Server README 環境表：[`server/README.md`](../server/README.md)
- Status／API 欄位：[`docs/api-docs/api.md`](./api-docs/api.md)
- 未來視雙區語意：[`docs/roadmap/0.17.0/docs/store-and-zones.md`](./roadmap/0.17.0/docs/store-and-zones.md)
