# HTTP API

預設 `http://127.0.0.1:8797`。無 auth。

讀取型 GET **同步讀檔**，毫秒級。  
`POST /events` **同步寫 pending**（不經 Pi）。  
會跑 Pi skill 的操作（`/distill`、`/ask`）**一律 202 + job**。

空集合回 **200** + `[]`／`null`／`present: false`。404 只給未知路徑。

---

## 讀取

| 方法 | 說明 |
|------|------|
| `GET /status` | `store_dir`、`timezone`、`pi_model`、`queue` |
| `GET /pool` | `{ pending, archived }` 各為事件陣列（新→舊） |
| `GET /chain?level=day\|week\|month\|year` | 該層 id 列表（新→舊） |
| `GET /chain/{level}/{id}` | `{ id, present, markdown }` |
| `GET /nodes` | `{ id, title }[]` |
| `GET /nodes/{id}` | `{ id, present, markdown }` |
| `GET /jobs` | 近 50 筆 job 摘要 |
| `GET /jobs/{id}` | 完整 job |

---

## 操作

| 方法 | body | 行為 |
|------|------|------|
| `POST /events` | `{ "raw": "…" }` | **同步** append 一筆到 pending（機械：現在時間、原句當 `raw`、不拆筆、不寫 `note`）。**200** `{ event }` |
| `POST /distill` | `{}` | 202 job → `engram-lite-distill` |
| `POST /ask` | `{ "q": "…" }` | 202 job → `engram-lite-ask` |

Pi 派工成功受理：**202** `{ job_id, status: "queued" }`，再 poll `GET /jobs/{id}`。  
要拆筆或寫 `note` 請用 pi-agent 的 **engram-lite-ingest** skill。

同時只跑 **一個** Pi job。避免兩場 distill 搶寫同一批檔。

---

## Job 檔

`data/jobs/{id}.json`

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
`ask` 完成時 `output.text`＝回答正文。
