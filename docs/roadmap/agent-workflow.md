# Roadmap 開發節奏（Agent 分工）

← [GUIDELINES.md](./GUIDELINES.md)（**寫什麼／如何自足**）· [AGENTS.md](../../AGENTS.md)

本檔（**`agent-workflow.md`**）規範 **版本從構想到出貨時，人與多個 agent 怎麼交接**。  
[`GUIDELINES.md`](./GUIDELINES.md) 管 roadmap **文件寫作**；本檔管 **誰開新 session、何時審查、何時 HANDOFF、何時測**。

兩檔一起讀：寫不夠自足 → 實作會猜；節奏亂 → 審查與實作互相污染 context。

---

## 為何要「新 agent 審查 → 回原 agent 收斂」

| 做法 | 用意 |
|------|------|
| **新 agent 做 review** | 無實作／討論殘留，只對 INDEX＋docs（或 diff）找洞；較像獨立設計／實作審查 |
| **回原 agent（或規劃 agent）處理 review** | 有產品脈絡，負責拍板、併入已定案、改文件；避免審查 agent 擅自改範圍 |
| **另開實作 agent＋HANDOFF** | 實作 context 乾淨；只認檔案、不認聊天 |

不要讓同一個長對話既腦暴、又實作、又自審——易漏定案、易自我合理化。

---

## 建議生命周期（中改以上）

```text
構想／backlog
    → 排程 INDEX（planned；可 rough）
    → 規劃對話：談清 scope → 寫滿已定案／docs／reasoning
    → 【可選】新 agent：design-review → 寫 docs/design-review.md
    → 回規劃 agent：覆核 findings → 併入 INDEX 已定案（清空「開工前仍須拍板」）
    → 寫／更新 HANDOFF.md（含貼上用 starter prompt）
    → 新 agent：依 HANDOFF 實作（in progress）
    → 【建議】新 agent：implementation-review → 寫 docs/implementation-review.md
    → 回實作／規劃 agent：修洞 → 複審通過
    → shipped：version／changelog／契約；勾驗收；清 backlog 列
```

小改（單一行為、INDEX 極薄）可縮成：自足 INDEX → 直接實作 → 自測；仍建議出貨前有人／agent 對照驗收勾一次。

---

## 角色與產物

| 角色 | 典型 session | 產物 | 不要做 |
|------|----------------|------|--------|
| **規劃** | 與使用者談產品 | INDEX、docs、reasoning、清空待拍板 | 大範圍實作（除非使用者明確要求邊談邊改） |
| **設計審查** | **新** agent | `docs/design-review.md`（對 INDEX／docs 找 HOW 留白、失敗模式） | 直接改程式；擅自把提議當已定案寫進 INDEX（除非使用者授權併入） |
| **規劃收斂** | 回原規劃 agent | 將同意的 D／F 併入已定案；更新 capture／reasoning；必要時改 HANDOFF | 忽略審查、口頭說「之後注意」卻不寫檔 |
| **實作** | **新** agent＋HANDOFF | 程式＋測試；INDEX → `in progress` → 驗收 | 發明 INDEX 未寫的語意；做非目標 |
| **實作審查** | **新** agent | `docs/implementation-review.md`（對 INDEX 驗收／已定案 vs diff） | 順便加功能 |
| **實作收斂** | 回實作 agent | 修 HIGH／同意的 MEDIUM；複審；再 `test:phases` | 未寫進審查追蹤就宣稱 shipped |

審查報告應標：**對照基準＝本版 INDEX**（已定案＋驗收）；設計審查結論區分「建議定案（尚未寫入）」vs「已併入」。

參考實例：

- 設計審查：`docs/roadmap/0.29.0/docs/design-review.md`
- 實作審查（完整四輪）：`docs/roadmap/0.29.0/docs/implementation-review.md`
- 實作審查（簡版兩輪）：`docs/roadmap/0.28.0/docs/implementation-review.md`

---

## Implementation review（實作審查）

中改以上 **碼大致完成後**，用 **新 agent** 寫 `docs/roadmap/X.Y.Z/docs/implementation-review.md`，再回 **實作 agent** 依追蹤表修洞。細節寫法見本節；**各版具體 H1／M3 內容留在該版報告**，workflow 只規範可複製的節奏。

### 輪次與職責

| 輪 | 誰 | 做什麼 |
|----|-----|--------|
| **初審** | **新** agent | 只讀 INDEX＋docs＋diff；對照已定案／驗收開 findings；跑 `test:phases` 並記錄 |
| **修復** | 回 **實作** agent | 只修審查追蹤項；每修一項更新同一份報告的狀態欄 |
| **複審** | 實作 agent 自核，或再開 **新** agent | 核對已關項；重跑 `test:phases`；留意 **迴歸**（修 A 壞 B） |
| **獨立核實**（中改以上建議） | **新** agent | 不延續實作對話；對碼＋phases 再驗一輪；可出貨結論寫在報告頂部 |

小改可縮成：初審 → 修復 → 複審（兩輪）。勿為每輪另開新檔——**同一 `implementation-review.md` 累加輪次與歷審摘要**。

審查 agent **不改程式**（與 design-review 對稱）。**Do not commit unless the user asks**（與 HANDOFF 一致）。

### Findings 分級

| 級 | 含義 | 出貨 |
|----|------|------|
| **HIGH** | 違反 INDEX 已定案／驗收、契約錯誤、資料／lock 安全、主路徑不可用 | **必須關閉** |
| **MEDIUM** | 文件／skill／測試漏網、邊界未覆蓋、與定案不一致的次要路徑 | **預設修**；可標「可選／非阻擋」並在結論說明 |
| **LOW** | 字串、命名、文件一句、觀測性 | 記錄即可；標 **可留** 不擋 shipped |

每項給 **穩定 ID**（`H1`、`M3`、`L2`），修復輪只改「狀態」與「證據」，勿重編號。

### 報告最低章節

檔頭元資料：

- 各輪日期（初審／複審／…）
- **對照基準**＝本版 INDEX 已定案／驗收
- **一兩句結論**（可否出貨、是否待使用者 commit）

正文建議順序：

1. **總評** — 按 Track 或面向；可表格式對照各輪（初審 vs 複審 vs 終審）
2. **Findings** — HIGH → MEDIUM → LOW；欄位：**ID｜題｜狀態｜證據／說明**
3. **驗收對照** — 逐條複製 INDEX 驗收 checklist，標通過／碼有／未過
4. **測試** — `bun run test:phases` 實際輸出或摘要；若曾紅必記
5. **修復追蹤** — checkbox 列表（H／M 必勾；L 可選）
6. **歷審摘要** — 每輪一句（防長對話污染；例：複審發現 H3 迴歸 → phases 紅）
7. **建議後續**（可選）— 非阻擋項、出貨後才做的文件補句

狀態用語建議：**待修**｜**已修**｜**可留**｜**非缺陷／已定案**（scope 爭議已併入 INDEX 時）。

### 出貨門檻

同時滿足才可標 INDEX `shipped`、改 `version.md`／`changelog`：

- [ ] 無未關閉 **HIGH**
- [ ] 同意的 **MEDIUM** 已修或明確標非阻擋
- [ ] INDEX **驗收** 全勾（或報告逐條對照通過）
- [ ] **`bun run test:phases` 全綠**（終審／獨立核實輪必跑）
- [ ] backlog 該列已清（若 INDEX 要求）
- [ ] 使用者同意後再 **git commit**（審查報告本身可一併 commit）

### 審查 agent 貼用 prompt（可選）

```text
你是實作審查 agent。只認檔案，不認 chat history。
先讀 AGENTS.md → docs/roadmap/X.Y.Z/INDEX.md（已定案＋驗收）→ HANDOFF → 相關 docs。
對照 working tree／diff 寫 docs/implementation-review.md（分 H/M/L、穩定 ID、含 test:phases 結果）。
不要改程式、不要加功能、不要 commit。
對照基準＝INDEX；做什麼以 INDEX 為準，報告只追實作落差。
```

---

## HANDOFF

中改以上 **實作前應有** `docs/roadmap/X.Y.Z/HANDOFF.md`：

- 讀檔順序、一句话產品摘要、Track 順序、禁區、錨點路徑、完成時檢查清單  
- 文末 **Paste-ready starter prompt**（新 chat 直接貼）  
- 明示：**Do not commit unless the user asks**  
- 對使用者回應語言：繁體中文書面語（`AGENTS.md`）

INDEX 文件地圖應鏈到 HANDOFF（見 0.28／0.29）。

Starter prompt 最低要素：

1. 只認檔案、不認 chat history  
2. 先讀 `AGENTS.md` → `HANDOFF.md` → `INDEX.md`＋其連結  
3. 跟 Track 順序做；禁非目標  
4. INDEX 沉默才提問，否則跟已定案  

---

## Track 節奏與測試

實作按 INDEX **Track** 推進（如 A→B→C→D）。

| 時機 | 測試期望 |
|------|----------|
| **每個 Track 結束** | 跑該 Track 相關 **unit／窄測**（及可 curl／手驗的契約）；修到該 Track 驗收句成立再進下一 Track |
| **全部 Track 結束** | 必跑 **`bun run test:phases`**（整包機械門檻） |
| **實作審查前後** | 再跑 `test:phases`；審查報告應記錄結果 |

不要只在最後才第一次跑測（相間回歸成本通常低於一次爆開）。  
若某 Track 尚無對應 phases 段，至少保留 unit／手驗，並在出貨 Track 補上 phases。

---

## 與 GUIDELINES 的分工（勿混）

| 檔 | 回答 |
|----|------|
| **GUIDELINES.md** | Roadmap 怎麼寫才自足？INDEX 要有哪些欄？何時要 reasoning？ |
| **本檔 `agent-workflow.md`** | 哪個 agent 做設計審查／實作／實作審查？HANDOFF 何時寫？implementation-review 怎麼輪？Track 之間測什麼？ |

寫作自足仍是硬門檻：審查與 HANDOFF **不能取代**「已定案寫進檔案」。

---

## 簡表：你現在卡在哪

| 狀態 | 下一步 |
|------|--------|
| 還在談產品 | 規劃 agent；更新 INDEX，勿開實作 |
| INDEX 自足但怕有洞 | **新** agent → design-review → 回規劃併入 |
| 待拍板已空 | 寫 HANDOFF → **新** agent 實作 |
| 碼大致完成 | **新** agent → implementation-review（初審）→ 回實作修 → 複審／獨立核實 |
| 驗收全勾、phases 過、無未關 HIGH | shipped 文件；使用者同意再 commit |

---

## 檢查清單（開實作 agent 前）

- [ ] INDEX 已定案完整；「開工前仍須拍板」為空（或僅標非目標）  
- [ ] 若做過 design-review：同意項已併入 INDEX／docs，報告標「已併入」  
- [ ] `HANDOFF.md` 存在且含 paste-ready prompt  
- [ ] 非目標寫清（防實作膨脹）  
- [ ] 使用者知悉：用 **新** chat／CLI session，不要延續腦暴長對話實作  
