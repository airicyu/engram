# 0.14.0 — 為何如此分組（reasoning）

← [INDEX](../INDEX.md) · 佈局契約：[store-layout.md](./store-layout.md)

> 做什麼以 INDEX／store-layout 為準。本檔只留動機與反例。若要改已定案，須先能回答「原本要防的失敗模式是否仍成立」。

---

## 要防的失敗模式

1. **頂層扁平、語意混雜**  
   L0／L1／L2／chain／dream staging／ask job／clock／空殼目錄擠在同一層 → 人眼與 agent 難分「活記憶」與「可丟執行態」。

2. **`memory/` 被佔用**  
   0.7 把 ask job 放在 `memory/ask/`，導致無法用 `memory/` 當活記憶根。Ask 是 Seek 作業產物，不是記憶本體。

3. **設定三處**  
   `engram.workspace.yaml` + `meta.yaml`（只寫不讀）+ `meta/clock.json` → timezone 語意重複；`meta.yaml` 已無讀者。

4. **空殼／廢契約殘留**  
   `archive/`、`dream/reviews/`、`dream/dead-letter-archive/`、`applied.yaml`、`candidates/nodes.yaml` 讓人以為還有未文件化流程。

5. **`candidates/` 頂層誤導**  
   建 node 已改 `propose_node`；頂層 candidates 像「第二套 L2 閘門」。實際只剩低信心 attribution，屬 dream 管線產物。

---

## 選定結構的理由

| 決定 | 為何 | 否決的替代 |
|------|------|------------|
| `memory/` 收活記憶 | 一眼是本體；與 dream／tmp 對立清楚 | 頂層繼續扁平；或 `live/`（與口語「memory」產品詞較遠） |
| L0 → `memory/activities/` | capture 是活動軌跡，不是 ops log | 保留 `log/events.jsonl`（與 replay ops log 搶名） |
| 保留目錄名 `short-term-memory`、`memory-chain` | 專業詞／搜尋關鍵字穩定；避免無謂 rename 噪音 | `memory/l1`、`memory/chain`（較短但搜尋與文件斷裂） |
| `future-sight` 進 `memory/` | 活錨點集合，屬記憶面而非 dream staging | 留頂層；或塞進 dream（過期硬清語意不像 draft） |
| `tmp/` 放 ask＋clock | 可丟、重啟／reset 可清；日後 git 化可 ignore | 繼續佔 `memory/ask`；clock 留 `meta/` |
| candidates → `dream/candidates/` | 與 patches／draft 同源管線 | 刪光 candidates（仍有低信心 episodic 寫入） |
| 刪 reviews／archive／dead-letter-archive／meta.yaml／applied | 無讀寫或已廢主路徑 | 「先留空目錄以後用」（製造幽靈契約） |
| 根 `log/` 僅 ops | L0 搬走後，`log/` 可專給 `replay-cursor.log` 之類 | 把 replay 塞進 `tmp/`（亦可；本版選 ops `log/` 較好找） |

---

## 刻意不做（本版 WHY）

- **不改 HTTP API 路徑**（仍 `/memory/ask`、`/capture`…）：磁碟 reorg ≠ 對外 URL reorg；混做範圍膨脹。
- **不做長期雙讀舊路徑**：與 0.11 day 分組相同——雙讀會讓 path helper 與文件永久分叉。
- **不把 dream-job／extract-state 搬進 tmp**：仍屬 dream 管線狀態，跟 `dream/` 同事較好找；若日後要「整個 dream 執行態可清」可另開版。
- **不在本版做 store-git**（見 backlog）：layout 先穩，事務模型另案。

---

## 與 0.13 的關係

0.13 引入 `engram.workspace.yaml`。0.14 **刪除 `meta.yaml`** 依賴此前提：有效 timezone／語言已有單一真相來源。若無 workspace 檔，行為仍走 env 預設（與 0.13 相同），不回退寫 `meta.yaml`。
