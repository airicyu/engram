# HTTP API

預設 `http://127.0.0.1:8797`（`ENGRAM_LITE_PORT` 覆蓋 `.env` 的同名鍵，再落到 `8797`）。無 auth。

讀取型 GET **同步讀檔**，毫秒級。  
機械寫入（`POST /events`、上傳附圖、釐清 submit／delete／aside）**同步落檔**（不經 Pi）。  
會跑 Pi skill 的操作（`/distill`、`/ask`）**一律 202 + job**。

**Store git（0.3.2）：** 下列操作**成功**結束後，server 可能在 `{store}` 根自動 `git init`（若尚無）並 **local commit**（單行 message `engram-lite: …`；不含正文）。失敗只記 log，不改已成功 HTTP。**不** push。**不**含純 skill CLI 直寫 vault 或唯讀 GET。

**空讀：** 列表／搜尋／釐清／圖等「無資料」→ **200**＋該端點既定 JSON envelope，其集合欄為空陣列（如 `{ hits: [] }`、`{ items: [] }`、`{ nodes: [], edges: [] }`）。404 只給未知路由，或附件 path 消毒後檔不存在。釐清缺題 submit／delete → 200＋`present: false`（冪等，不是 404）。

契約細節以 [`docs/data-spec.md`](data-spec.md) 與各版 `docs/roadmap/X.Y.Z/INDEX.md` 為準（現行見 [`version.md`](../version.md)）。

---

## 讀取

| 方法 | 說明 |
|------|------|
| `GET /status` | `store_dir`、`timezone`、`pi_model`、`queue` |
| `GET /pool` | `{ pending, archived }` 各為事件陣列（新→舊） |
| `GET /chain?level=day\|week\|month\|year` | `{ level, ids, items: [{ id, preview?, start?, end? }] }`（新→舊；`preview` 機械截取正文；週項含 `start`／`end`） |
| `GET /chain/{level}/{id}` | `{ id, present, markdown, path? }`。`level=week` 時 `id` 須為 `YYYY-Www-MMDD`（`MMDD`＝該 ISO 週週一）；非法 → **400** `invalid_week_id`。週詳情另回 `start`／`end`（`YYYY-MM-DD`，週一～週日），即使 `present: false` |
| `GET /future-sight` | `{ anchors: [{ id, zone, anchor_start, anchor_end, content }], swept_expired, future_sight_window_days, future_sight_upcoming_days }`。每次 **expire-only** 維護（過期項移除並 append 機械事件到 pending）；檔有變更時 store git commit。UI：`#/memory/future` |
| `GET /nodes` | `{ nodes: [{ id, title, activity_score? }] }`（`activity_score` 0–100，無則省略） |
| `GET /nodes/{id}` | `{ id, present, markdown, activity_score? }` |
| `GET /nodes/graph` | `{ nodes: [{ id, title }], edges: [{ from, to }] }`。點＝現有 node；邊＝掃描 node 檔 wikilink，只保留兩邊都存在的點；無向去重（字典序小的當 `from`）。空庫 `{ nodes: [], edges: [] }`。**不**經 Pi |
| `GET /search?q=` | `{ hits: [{ path, snippet }] }`。`q` trim 後不可空否則 **400**。掃 `memories/chain/**/*.md`、`memories/nodes/**/*.md`、`memories/pool/pending.jsonl`；**不**掃 archived／jobs／clarify／`_attachments` bytes。大小寫不敏感子字串；最多 50 筆；空 hits 仍 200。`path` 相對 vault。**不**經 Pi |
| `GET /clarify/asking` | `{ items: [{ id, ts, markdown }] }`，新→舊；無題 200＋`items: []` |
| `GET /clarify/pending` | 同上 |
| `GET /attachments/file?path=` | 僅允許 `_attachments/uploads/{day}/{filename}`；正式檔 200＋對應 Content-Type；缺檔 **404** |
| `GET /jobs` | 近 50 筆 job 摘要 |
| `GET /jobs/{id}` | 完整 job |

---

## 操作

| 方法 | body | 行為 |
|------|------|------|
| `POST /events` | `{ "raw": "…", "attachments"?: [{ "path", "relationship" }] }` | **同步** append 一筆到 pending（機械：現在時間、原句當 `raw`、不拆筆、不寫 `note`）。`raw` 必非空。若有 embed 或非空 `attachments`，兩邊 path 集合須相等（見 data-spec）；否則 **400**。`raw` 內 `[@…](node-create:{id})`：id 非法 → **400** `invalid_mention_id`；id 已有 live node → **400** `mention_create_exists`。無圖 → 與 0.2 相同。**200** `{ event }` |
| `POST /attachments` | multipart 欄位 `file` | MIME 僅 jpeg／png／webp／gif；上限 10 MiB；寫入 `memories/_attachments/uploads/{當地日}/`（無 tmp）。**201** `{ path, day, filename }` |
| `POST /clarify/asking/{id}/submit` | `{ "answer": "…" }` | 寫答案、移到 `clarify/pending/`。缺檔 → 200＋`present: false`。非法 id → 400 |
| `DELETE /clarify/asking/{id}` | — | 移到 `history` 並標 dismissed。缺檔 → 200＋`present: false`。非法 id → 400 |
| `POST /clarify/aside` | `{ "raw": "…" }` | 在 `clarify/pending/` 新建 aside（`kind: aside`）；**不是** pool 事件。**200** `{ id, present: true }` |
| `POST /distill` | `{}` | 202 job → `engram-lite-distill`（與 UI 按鈕、crontab 同一 worker） |
| `POST /ask` | `{ "q": "…" }` | 202 job → `engram-lite-ask` |

Pi 派工成功受理：**202** `{ job_id, status: "queued" }`，再 poll `GET /jobs/{id}`。  
要拆筆或寫 `note` 請用 pi-agent 的 **engram-lite-ingest** skill。

同時只跑 **一個** Pi job。避免兩場 distill 搶寫同一批檔。

定時沉澱：**不要**在 process 內建 cron；系統 crontab 對 `POST /distill` 即可（與按鈕同一 worker）。

---

## Job 檔

`{store}/jobs/{id}.json`

```json
{
  "id": "job_…",
  "kind": "distill",
  "status": "queued",
  "created_at": "…",
  "updated_at": "…",
  "input": { "raw": "…" },
  "output": { "text": "…" },
  "error": null,
  "log": []
}
```

`kind`：`distill`｜`ask`。  
`status`：`queued`｜`running`｜`completed`｜`failed`。  
`ask` 完成時 `output.text`＝回答正文。尋問 UI 可列近 20 筆 `kind===ask` 且終態的摘要（題目用 `input.q`），點選展示 `output.text`，**不**重跑。
