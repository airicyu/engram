# L1 作為 mem pool（想法）

← [0.3.0 INDEX](./INDEX.md) · 配合 [dream-approve.md](./dream-approve.md)

## 生物類比（產品直覺）

多數時候：夢在睡覺時發生，睡覺時沒有清醒活動 → **沒有並行 ingest**，整包清 L1 也夠用。

實際上還有：

- 夢到一半被打斷（extract／approve 未完成）
- **白日夢**：夾在日間活動之間的 distill

比較貼近的模型：

> L1 ≈ **mem pool（短期工作記憶）**  
> Dream = 把 pool 裡一批東西 **distill** 進 L2  
> 已 distill 的從 pool 拿掉；未 distill 的留下待下一輪  
> Pool **不能**永久囤大量資訊（容量／遺忘另議；本版先做「按範圍清」）

因此：**pending 期間允許 ingest**（新東西進 pool，但不屬於本輪 dream 範圍）。

## 現行問題

| 設計意圖（早期） | 現行實作 |
|------------------|----------|
| apply 後清「本輪範圍內」的 L1 | `clearL1()` **整包**清空 markdown |
| pending／白日夢期間新 ingest 應留下 | 一旦清 L1，新舊一起沒 |

L1 目前是鬆散、可讀的 markdown（`summary.md` + node notes）。行內雖有 `(event_id)`，清理邏輯**沒用**它當邊界。

## 做法（夠用、不完美）

**L1 改成可按 L0 `event_id` 索引的結構**（presentable 仍可合成 markdown 給人看／給 activate）。

```
dream extract 開始
  → 凍結本輪範圍 S = 當時 pool 內的 event id 集合
     （或顯式傳入／預設「截至此刻全部 pending」）
  → extract 只基於 S（+ 對應 L0 raw + L1 視圖；**可跨日**，見 INDEX #15）
  → materialize → draft + 寫入 pending：patches + report + **scope: S**

pending 期間
  → 新 ingest → 新 event 進 pool，id ∉ S
  → 不自動併入本輪 pending（要納入 = supersede 重夢）

approve 且 **commitDraft** 全成功
  → 只從 L1 pool **刪除 id ∈ S 的條目**
  → id ∉ S 的留下

discard / supersede
  → 不動 L1 pool（或 supersede 時用新的 S'）
```

這不是最優雅的記憶模型，但邊界清楚、機械層可做，**至少 work**。

### 呈現 vs 儲存

- **儲存：** 以 event 為鍵（每條對應一筆 L0；可附短 note／node_refs 投影）
- **呈現：** 仍可 render 成現在這種 markdown，給人與 activate 讀
- **清理：** 按 id 集合刪，不靠「猜 markdown 哪一段」

## 審批時的危險：記憶錯亂／leak

Dream review 時，使用者可能叫 AI「直接改記憶」——若 agent：

- 手改 L2／L1 檔，或
- 繞過 approve、對範圍外 event 清／寫，或
- 改了 L2 卻沒把對應 id 移出 pool（**leak**：同一事實 L1+L2 雙活）／  
  清了 pool 卻沒成功進 L2（**丟記憶**）

就會錯亂。

### 緩解原則（草案）

| 允許 | 禁止（workbench／skill 契約） |
|------|------------------------------|
| 讀 pending report | pending 期間 **直接寫 L2** |
| 指出問題 → **supersede 重夢** | 手改 `ENGRAM_HOME` 下 L1／L2「幫忙改對」 |
| `approve`／`discard` API | 清 L1 時使用 **非本輪 S** 的 id |
| （可選）只改 report 文案、不改 patch 語意 | 把新 ingest 的 id 偷偷併進已凍結的 S |

**Approve 是唯一：S → 寫 L2 + 從 pool 移除 S。**  
人要改內容 = 重夢（已定：supersede），不是邊審邊開刀記憶檔。

「Memory leak」在此特指：事實已進 L2，但對應 event 仍留在 L1 pool，之後再夢又蒸餾一次 → 重複／矛盾。反向則是 pool 清了但 L2 沒寫上。

半失敗（0.3 draft staging）：approve 前 L2 不動；`commitDraft` 失敗則 L2 仍不變、L1 全留（含 S），可重試 approve。無 L1∩L2 半套重疊。

## 與「整包 L1 重夢」的關係

- **Supersede：** 新 run 的 S' = 當下 pool 全部（或顯式範圍），舊 pending 丟棄；自然包含 pending 期間新 ingest。
- **Approve 舊 pending：** 仍只清舊 S；S 之後才進 pool 的留下。

## 開放問題

1. Pool 條目除 event 投影外，是否允許「無 L0 的純 L1 筆記」？（若允許，清範圍要用別的 id）
2. Node notes：是否只是 per-event 的二次索引，清理仍跟 event id？
3. Pool 容量／遺忘（eventually 消失）：**0.3 只做按 S 清**；遺忘另開或更後版本。
4. Extract 預設 S = **呼叫當下整個 pending pool**（已定案）。子集指定可後加。

## 非目標

- 把 L1 做成完整 DB／向量庫
- 審批 UI 內嵌「任意編輯 L2」
- 睡眠／白日夢的自動排程（仍手動或之後 cron）
