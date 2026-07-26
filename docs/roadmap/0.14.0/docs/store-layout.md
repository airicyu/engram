# 0.14.0 — 記憶庫目標目錄佈局

← [INDEX](../INDEX.md) · 推理：[reasoning.md](./reasoning.md)

> **實作契約：** 路徑長什麼樣、舊→新對照、ensure 建什麼。API 對外仍只暴露 id／語意欄位，不暴露資料夾分組細節（與 0.11 chain 相同原則）。根目錄由環境變數 **`ENGRAM_STORE_DIR`** 指向。

---

## 目標樹（記憶庫根）

```
<ENGRAM_STORE_DIR>/
├── engram.workspace.yaml
├── memories/                          # 活記憶本體
│   ├── activities/
│   │   └── events.jsonl               # L0
│   ├── short-term-memory/
│   │   ├── pool.jsonl
│   │   ├── summary.md
│   │   └── nodes/
│   ├── chain/
│   │   ├── days/YYYY-MM/…
│   │   ├── weeks/YYYY-MM/…
│   │   ├── months/YYYY/…
│   │   ├── years/…
│   │   └── initialized_{weeks,months,years}.yaml
│   ├── nodes/{id}/…
│   └── future-sight/
│       └── active/{id}.md
├── dreams/                            # 管線／L1.5
│   ├── patches.jsonl
│   ├── dead-letter.jsonl
│   ├── dream-job.yaml
│   ├── extract-state.yaml
│   ├── reports/{run_id}.md
│   ├── runs/…
│   ├── draft/{run_id}/…
│   └── candidates/
│       └── attribution.yaml
├── tmp/
│   ├── ask/jobs/{job_id}/…
│   └── clock.json
└── log/                               # 可選 ops（非 L0）
    └── replay-cursor.log
```

### HTTP 對齊（硬切）

| HTTP | 磁碟／語意 |
|------|------------|
| `POST /activities` | 寫入 `memories/activities/events.jsonl` + L1 |
| `/dreams/*` | `dreams/` 管線 |
| `GET /memories/short-term-memory` | `memories/short-term-memory/` |
| `/memories/chain…` | `memories/chain/` |
| `GET /memories/future-sight` | `memories/future-sight/active/` |
| `/memories/search`、`/memories/ask`、`/memories/nodes…` | 對應 `memories/` 下活檔 |
| `/clock`、`/status` | 不變 |

無舊 URL alias（`/capture`、`/dream/*`、`/memory/*`、`/future-sight`）。

---

## 層對照

| 層 | 磁碟 |
|----|------|
| L0 | `memories/activities/events.jsonl` |
| L1 | `memories/short-term-memory/pool.jsonl` |
| L1.5 intent | `dreams/patches.jsonl`、`dreams/reports/` |
| L1.5 draft | `dreams/draft/{run_id}/` |
| L2 | `memories/nodes/{id}/understand/what.md` |
| chain | `memories/chain/…` |
| future-sight | `memories/future-sight/active/` |
| attribution | `dreams/candidates/attribution.yaml` |
| ask 執行態 | `tmp/ask/jobs/` |
| 虛擬時鐘 | `tmp/clock.json` |
