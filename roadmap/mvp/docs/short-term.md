# Short-term Memory（工作記憶）

← [INDEX](../INDEX.md)

```
short-term-memory/
├── today-summary.md           # 全局：今天整體
├── meta.yaml                  # 可選：dreaming: true/false
└── nodes/
    └── {node-id}/
        └── notes.md           # 與該節點相關的今日沉澱
```

## 日間

- input → append L0 + 寫 L1
- 讀取 = L2 + L1，**L1 優先**
- 不完整 digest；最多輕量標 `node_refs`
- **只跑 Ingest**（與 Dream 不並行）

## 夜間

`dream run` = extract → apply 連跑（詳 [dream.md](./dream.md)）：

1. extract — L1 + events + 相關 L2 Current → L1.5 patches  
2. apply — 逐筆寫入；失敗進 DLQ、繼續；**跑完清空 L1**  
3. L0、L1.5 不動  

### MVP 夜間寫入

| 級別 | 目標 |
|------|------|
| Required | `understand/what.md`、`memory-chain/days/`、`candidates/*` |
| Optional | `chronology/recent.md` |

### 後期

- 週／月關帳、chronology 歸檔（獨立 job）

## 失敗語意

| 情況 | L1 | 感知 |
|------|----|------|
| extract 整段失敗 | 保留 | 仍讀 short-term；可重跑 dream |
| apply 單筆失敗 | run 結束仍**清空** | 該筆在 `dead-letter`；其餘已進 L2 |
| apply 全成功 | 清空 | 讀 L2 + day chain |
