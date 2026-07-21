# 0.3.0 設計審查報告

← [INDEX](./INDEX.md)

> **日期：** 2026-07-19  
> **範圍：** `INDEX.md`、`dream-approve.md`、`l1-mempool.md`、`timeline.md`（對照現行 server／API／0.4 預留）  
> **結論：** 方向正確；**洞 #1–#3 與中高風險 #4–#8 已於 2026-07-19 定案**（見 [INDEX 已定案 #14–#20](./INDEX.md#已定案2026-07-19)）。可開實作。

## 總評

| 面向 | 判斷 |
|------|------|
| Dream approve 閘門 | 對：未批不寫 L2、唯一 pending、supersede |
| L1 mem pool + 按 S 清 | 對：支援 pending 期間 ingest／白日夢 |
| World timeline + 禁未來 chain | 對：與 0.4 未來視接點正確 |
| 文件完整度 | **已補**：draft staging（#14）、extract 輸入、未來日時鐘、Consolidate 最小面 |

**狀態：** 審查結論已併入 INDEX 已定案表 — 2026-07-19

---

## 必須先補的洞

### 1. 半失敗後的冪等 — **已定案：選項 D（draft staging）**

**原問題：** 現行 per-patch apply + `applied.yaml`（per `patch_id`）在 supersede 下冪等失效。

**定案（#14）：** L0.5 拆成 **intent**（patches + report）+ **draft**（materialize 投影）。Approve 前不寫 L2；`approve` = 原子 `commitDraft`。

| 情境 | 行為 |
|------|------|
| pending_review | L2 不變 |
| commit 成功 | L2 更新；清 S |
| commit 失敗 | **L2 不變**；L1 全留；可重試 approve |
| supersede | 丟 intent + draft；L2 不變 |

**廢除：** per-patch 即時 apply 作為主路徑；`applied.yaml` per `patch_id` 不再作為 approve 冪等核心。

（審查時曾列 A／B／C；見 git 歷史。D 由 staging 模型涵蓋，無需 A 的 `approve_incomplete` 禁 supersede。）

### 2. Extract 輸入範圍 — **已定案（#15）**

**定案意圖：** S 可跨多日；occurrence backfill；extract 基於 S。

**現行：** `buildExtractContext` 使用 `eventsForDay(今日)`，不是「S 內全部 L0」。

**若不寫死：** 時間線設計紙上成立，機器仍只夢見今天。

**須 lock 的不變式：**

> Extract 輸入 = S 對應的**全部** L0 event（可跨日）+ 由 S 合成的 L1 視圖（+ 既有 L2／nodes）。  
> 廢除「只取今日 events」作為 dream 範圍。

### 3. 「未來日」的時鐘基準 — **已定案（#16）**

**定案：** 禁止 `chain.id` = 未來日當 occurrence。

**未定：** 「未來」相對誰？

- extract 當下的 Taipei 日？
- approve 當下？
- 各 event 的 encoding 日？

Pending 跨午夜時，「明天」會變成「今天」。同一批 pending 可能昨晚合法、今早 apply 語意翻轉。

**定案：**

> 以 **approve 當下** 的 Asia/Taipei calendar day 做硬校驗（拒收未來 `chain.id`）。  
> Extract 用同一規則預檢；邊界案例見 [timeline.md](./timeline.md)。

---

## 中高風險（建議開工前定案）

### 4. Web Consolidate — **已定案（#17）**

**定案：** 0.3 出貨含 Consolidate **最小面** — pending 時顯示 report 摘要 + Approve／Discard；Run 改文案為 Extract。

### 5. L0.5／run 生命週期 — **已定案（#14、#20）**

- intent：`patches.jsonl` + report；draft：`dream/draft/{id}/`
- run 狀態：`pending` \| `committed` \| `superseded` \| `discarded`
- `GET /dream/pending` 只回 `pending` 的 active run
- supersede／discard 後舊 run 不可再 approve（`dream_run_id` 不符 → 409）

### 6. 空 pool — **已定案（#19）**

`POST /dream/run` 在 L1 空或 S=[] → **409** `nothing_to_dream`。

### 7. Encoding meta — **已定案（#18）**

同日發生又同日寫入時，occurrence = encoding。若兩邊都寫 chain，易重複。

**建議：** 同日只寫一條 occurrence；encoding meta **僅當** occurrence 日 ≠ encoding 日。

### 8. 文件矛盾 — **已修正**

多輪 review = supersede；`timeline.md`／`AGENTS.md`／`dream-approve.md` 已對齊 INDEX。

---

## 可接受的開放題（不擋開工）

| 題 | 為何可後定 |
|----|------------|
| 關帳 week／month 與 backfill | 已標非目標；先禁未來日即可 |
| 相對日期失敗是否擋 approve | 人審可兜；可先 report 標 open + 允許 approve |
| Pool 容量／無 L0 的純 L1 筆記 | 本版只做按 S 清 |
| 自訂 `event_ids` 子集 | 預設整池已定；子集後加 |
| Report 是否結構化 section | markdown 夠用即可 |

## 實作契約補充（2026-07-19，#21–#25）

見 [INDEX #21–#25](./INDEX.md#manifest-最小-schema23)。原審查三項 staging 細節已 lock。

---

## 設計站得住的部分

- **Pending 唯一 + supersede**、`pending_review` 可 ingest、approve 成功只清 S：邊界清楚，對齊白日夢。
- **Memory-chain = world timeline**、未來日不進 chain、Future mentions 預留 0.4：與 [0.4.0](../0.4.0/INDEX.md) 接點正確。
- **Review 禁止手改 L1／L2**：防 leak（L1∩L2 雙活）與丟記憶；須寫進 operator skill 契約。
- **無資料用 200 + `present: false`**：與 API 通則一致。
- **Lock 只包 extracting／applying**，不包 `pending_review`：正確。
- **取消 run 自動 apply／resume apply**：與閘門模型一致。

---

## 已定案條文（已寫入 INDEX）

見 [INDEX 已定案 #14–#20](./INDEX.md#已定案2026-07-19)。

---

## 建議實作順序（審查後修訂）

在 INDEX 原順序之前插入：

0. Lock 洞 #1–#3（及建議 #17 產品路徑）  
1. L1 改 event 索引 + scope S  
2. dream：extract → 唯一 pending；supersede；approve／discard（含 L0.5 生命週期）  
3. extract 輸入改為 S 跨日 L0；prompt：occurrence／encoding；未來日校驗  
4. `/status`、operator skill、Consolidate 最小面、`api-docs`、changelog／version  

---

## 對照文件

| 文件 | 本報告主要對應 |
|------|----------------|
| [dream-approve.md](./dream-approve.md) | 洞 #1、#5；風險 #4、#8 |
| [l1-mempool.md](./l1-mempool.md) | 洞 #2；風險 #6 |
| [timeline.md](./timeline.md) | 洞 #3；風險 #7 |
| [INDEX.md](./INDEX.md) | 總覽、建議定案條文 |
| [0.4.0 INDEX](../0.4.0/INDEX.md) | 未來視接點（本報告無異議） |

---

**狀態（初審）：** review closed — 定案已併入 INDEX — 2026-07-19

---

## 二次審查（2026-07-19，draft staging 定案後）

> **範圍：** INDEX #14–#25、更新後的 `dream-approve`／`l1-mempool`／`timeline`／`AGENTS.md`  
> **結論：** 初審洞口已關閉；**可開實作**。剩餘為實作期契約細節（建議開工前短補 2–3 條，不推翻模型）。

### 初審追蹤

| 原項 | 狀態 |
|------|------|
| 洞 #1 半失敗冪等 | **關閉** — draft staging + 原子 `commitDraft`（#14、#2） |
| 洞 #2 Extract 輸入 | **關閉** — #15 |
| 洞 #3 未來日時鐘 | **關閉** — #16 |
| 風險 #4–#8 | **關閉** — #17–#20；文件已對齊 |
| staging 細節 | **關閉** — #21–#25 |

### 仍建議短補（不擋開工，但避免實作各寫一套）

#### A. `commitDraft` 崩潰安全 — **已定案（#26）**

**決定：** 可接受風險。行程內失敗盡力 rollback；kill／斷電不保證跨檔原子。復原靠 daily backup，或將 data folder（日後可 config 為外部路徑）用 git 管理／備份。**0.3 不做** journal／commit-staging。

#### B. Commit 成功、清 S 失敗 — **已定案（#27，B1）**

先 commit 再清 S。commit 成功即 `committed`；清 S 失敗 → `l1_clear_pending`；再 `approve` = 只清 S；`/status` 暴露。欠清 S 時不當未處理 pending 去 supersede 重蒸餾同批。

#### C. Approve 擋未來 `chain.id` 時 pending 命運 — **已定案（#28，C1）**

`409` `future_chain_id` + `rejected_chain_ids`；pending／draft／L1／L2 不動；可稍後再 approve、supersede 或 discard。不自動 strip／不自動 discard。

#### D. 空 patches、非空 S — **已定案（#29，D3）**

可進 `pending_review`；report 註明無擬寫入。`approve` = 不寫 L2、仍清 S（人確認無可 distill → discard 短期）。UI／report 須明示此含義。非 D4（不自動清）。

產品對齊：dream = distill 短期 → 長期，再 discard 短期；若無可 distill，人審後單純 discard 短期亦合理。

#### E. 同 run 新 node + 記憶 — **已定案（#21 修訂、#30；否定 E1）**

**產品：** 新認識一人並發生事情 → 一場夢應能同時生出 node 認知與相關記憶。  
**舊權宜：** 新 node 只進 candidates、另開人審建 node——因 AI 易濫建、不懂收束；**0.3 拿掉這道閘**。  
**人審：** 整場 dream `approve` 已覆蓋「要不要這些新 node」；不必第二道建 node 審批。  
**膨脹：** 後續做 **merge nodes**（人判、AI 執行）。AI 傾向少 breaking → 易 create、難主動 merge；故 merge 不宜只靠自動。0.3 不做 merge。  
**程序：** materialize 先 create 本 run 新 id，再寫 what／episodic；指向未 create 且 live 不存在的 id → fail。  
**保留：** 低信心 attribution → `candidates/`（歸屬不確定），與「能不能建 node」分開。

### 小文件不一致

- `l1-mempool.md` 仍寫「approve 且 **apply** 全成功」→ 應改 **commitDraft**。  
- `design-review` 洞 #2／#3 內文仍留「須 lock／未定」口吻（歷史段落）；以 INDEX 與本節為準。

### 可後定（仍不擋）

| 題 | 註 |
|----|-----|
| 低信心 episodic → attribution candidates | 現行碼 0.6；與建 node 路徑分離（#21） |
| Node merge | 後續版；人判 + AI 執行 |
| `dlq_review` patch × draft | 原型本就不支援 apply；0.3 可維持丟棄／忽略 |
| Encoding meta 獨立 patch type | timeline 開放題 |
| 既有 store 遷移（`applied.yaml`、未清 resume） | 實作／reset 說明即可 |

### 二次總評

二次審查 A–E 均已定案（#26–#30；E 為允許 dream 直接 create node，非 E1）。可開實作；小文件（l1-mempool 用語）實作前順手改即可。

**狀態：** second pass closed — A–E locked — 2026-07-19
