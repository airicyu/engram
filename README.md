# Engram Lite

簡化版個人記憶：**skills 寫檔是主體**，Bun server／UI 是輔件。

完整 Engram 有 dream staging、approve、git、clarify。這裡沒有。現行 **0.2.0**（[`version.md`](version.md)）。資料契約見 [`docs/data-spec.md`](docs/data-spec.md)。版本細節見 [`changelog.md`](changelog.md)、[`docs/roadmap/`](docs/roadmap/)。

倉庫內 [`demo-engram-lite-data/`](demo-engram-lite-data/) 是虛構 VIP 示範記憶（已 distill 的 chain／nodes／archived）。`engram-lite.yaml` 預設指這裡。自己的記憶請改 `store_dir` 或設 `ENGRAM_LITE_STORE_DIR`。若用 Obsidian，請開啟庫內的 **`memories/`**（不要開 store 根；`jobs/` 是派工暫存）。

## 設定

本專案**不**自帶 OpenRouter／模型 token，也沒有 `bun run setup`。LLM 憑證用你本機已經設好的 [Pi](https://pi.dev)（`pi` CLI）。

| 需要 | 說明 |
|------|------|
| [Pi](https://pi.dev) | 互動式 ingest／distill／ask；憑證在 `~/.pi/agent/auth.json`，或環境變數如 `OPENROUTER_API_KEY`、`DEEPSEEK_API_KEY` |
| [Bun](https://bun.sh) | 可選：跑 UI／`POST /events`。沒裝 Bun 仍可用 `pi` |

首次把 Pi 登入好即可（擇一）：

```bash
pi          # 互動裡 /login openrouter（或選 API key）
# 或
export OPENROUTER_API_KEY=sk-or-...
```

之後在**本倉庫根目錄**開 `pi`，它會載入 `.agents/skills/`。Server 用同一套 `ModelRuntime.create()`（預設讀 `~/.pi/agent/` 與上述 env），**不會**讀 engram-lite 的 `.env`。

預設模型 `deepseek/deepseek-v4.1-flash`（`workspace.yaml` 的 `pi_model`）。只影響 Bun server 的 SDK；你在終端機跑 `pi` 仍用 `~/.pi/agent/settings.json`。

只開 UI 翻示範庫可以不呼叫模型；**distill／ask（以及 pi-agent ingest）沒有可用憑證會失敗**。

## 不開 server（建議先這樣用）

```bash
cd engram-lite
pi
```

1. **輸入事件** — 用 `engram-lite-ingest`，把原句梳理進 `{store}/memories/pool/pending.jsonl`
2. **沉澱記憶** — 用 `engram-lite-distill`，把 pending 寫進日記／週月年記與 nodes，並移到 `archived.jsonl`
3. **查問** — 用 `engram-lite-ask`，只讀記憶鏈與 pending，不改檔

## 可選 UI

```bash
bun install
bun run dev
```

瀏覽器開 `http://127.0.0.1:8797`。記入 pool 同步寫檔；沉澱／提問仍 **202** 並輪詢 job。

環境變數：`ENGRAM_LITE_STORE_DIR`（覆蓋 `engram-lite.yaml` 的 `store_dir`，預設 `./../engram-lite-data`）、`ENGRAM_LITE_PORT`（覆蓋 yaml 的 `port`，預設 `8797`）、`ENGRAM_LITE_TZ`、`ENGRAM_LITE_PI_MODEL` 或 `PI_MODEL`（覆蓋記憶庫 `workspace.yaml` 的 `pi_model`，預設 `deepseek/deepseek-v4.1-flash`）。

## 為什麼 API 不會等 Pi 等到 timeout

Pi 可能跑數十秒到數分鐘。若 POST 同步 `await session.prompt()`，瀏覽器、反向代理、雲端 load balancer 常在 30–60s 斷線，但模型其實還在寫檔。

做法：

1. POST 只建 `{store}/jobs/{id}.json`（store 根，不進 `memories/`）並入列，**202** 立刻返回
2. 背景單一 worker 再 `createAgentSession`＋`prompt`
3. 客戶端 poll `GET /jobs/{id}`（本 UI 約每 1.5s）
4. 完成後再打對應 GET 重整畫面

這與「HTTP request timeout」解耦。重開 server 時，卡在 `running` 的 job 會標 `failed`（不保證半寫入回滾；distill 應寫完再移 pending）。
