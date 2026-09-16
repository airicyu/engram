# Engram Lite

簡化版個人記憶：**skills 寫檔是主體**，Bun server／UI 是輔件。

完整 Engram 有 dream staging、approve、git、clarify。這裡沒有。資料契約見 [`docs/data-spec.md`](docs/data-spec.md)。

## 不開 server（建議先這樣用）

在本倉庫根目錄開 pi-agent，它會載入 `.agents/skills/`：

1. **輸入事件** — 用 `engram-lite-ingest`，把原句梳理進 `data/pool/pending.jsonl`
2. **沉澱記憶** — 用 `engram-lite-distill`，把 pending 寫進日記／週月年記與 nodes，並移到 `archived.jsonl`
3. **查問** — 用 `engram-lite-ask`，只讀記憶鏈與 pending，不改檔

## 可選 UI

```bash
bun install
bun run dev
```

瀏覽器開 `http://127.0.0.1:8797`。記入 pool 同步寫檔；沉澱／提問仍 **202** 並輪詢 job。

環境變數：`ENGRAM_LITE_STORE_DIR`（覆蓋 `engram-lite.yaml` 的 `store_dir`，預設 `./../engram-lite-data`）、`ENGRAM_LITE_PORT`（預設 `8797`）、`ENGRAM_LITE_TZ`、`ENGRAM_LITE_PI_MODEL` 或 `PI_MODEL`（覆蓋記憶庫 `workspace.yaml` 的 `pi_model`，預設 `deepseek/deepseek-v4.1-flash`）。

## 為什麼 API 不會等 Pi 等到 timeout

Pi 可能跑數十秒到數分鐘。若 POST 同步 `await session.prompt()`，瀏覽器、反向代理、雲端 load balancer 常在 30–60s 斷線，但模型其實還在寫檔。

做法：

1. POST 只建 `data/jobs/{id}.json` 並入列，**202** 立刻返回
2. 背景單一 worker 再 `createAgentSession`＋`prompt`
3. 客戶端 poll `GET /jobs/{id}`（本 UI 約每 1.5s）
4. 完成後再打對應 GET 重整畫面

這與「HTTP request timeout」解耦。重開 server 時，卡在 `running` 的 job 會標 `failed`（不保證半寫入回滾；distill 應寫完再移 pending）。
