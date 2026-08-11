# Backlog — Activities `@` node mention composer

← [backlog INDEX](./INDEX.md) · 相關：同名／id 消歧（對話構想；未另開檔）· 現行 API：`POST /activities` 可選 `node_refs: string[]`（0.20+）

> **狀態：** 構想 only；**不**排進 [0.31.0](../0.31.0/INDEX.md)。排進某版前須寫自足 INDEX（含 create-intent 契約與 id 規則）。

## 題目

Activities 捕捉不要只靠純 textarea：做成 **input area／composer**。輸入 `@` 時開啟 mention：

1. **既有 node：** 打字篩選（如 `ke`）→ dropdown 命中 `ken` → 選中後變成 **指向該 node 的 pill／tag**（穩定綁 `node id`，不是顯示字串）。
2. **尚不存在：** `@tommy` 後 Enter（或同等「確認新建」）→ pill 標記為 **create intent**；入夢時 dream **應建立**對應 L2 node（id／主檔），並把本則 activity 與其關聯。

如此 L0／short-term → dream 不再只靠模型從散文猜「講的是哪一個 Ken」，人在捕捉當下就消歧或明示要新建誰。

## 為何值得做

- **同名／撞名：** 兩個 Ken 若都靠短名散文，入夢易併錯；`@` 選到具體 id（或明示新建另一 id）是人機協作消歧。
- **取代不自然的 `node_refs`：** 平行陣列、與正文脫節，實際幾乎無人用；本項以作文中的 mention 為唯一人機介面。
- 與 0.31 chain／Relation wikilink 互補：捕捉時就釘 id，寫入時互指更穩。

## 已定構想：廢除 `node_refs`

排進 version **實作本項時**：

- **移除**（或 breaking 棄用後刪）capture API／L0 event／short-term／文件／phases 中的 **`node_refs`**。
- **不要**「composer 底下再留一個 node_refs 多選框」或「UI 寫 mention、API 仍叫 `node_refs` 當別名長期共存」。
- 關聯語意改由本項的 mention 契約承載（欄位名另定，見下表）；舊庫 event 若仍含 `node_refs` 鍵：讀取時 **忽略** 或一次性 migrate 丟掉（定案時選一種；預期無依賴）。

產品理由：側車 id 列表與敘事分離＝不自然；`@` pill 才是意圖所在。

## 粗範圍（將來定案時寫進 version INDEX）

### UI

- Activities 主輸入＝composer（可與附件拖放並存；附圖仍走 0.29 路徑）。
- `@` 觸發 mention popover；keyboard：箭頭／Enter／Esc；選中＝insert pill。
- Pill 兩態（產品名待定）：**ref**（已存在 id）｜**create**（使用者宣告要新建）。
- Submit 時：正文可含 pill 的序列化形（見下）＋（若需要）**新的**結構化陣列給 API——**不是**舊 `node_refs`。

### 資料／API（待拍板）

| 題 | 選項方向 |
|----|----------|
| **廢 `node_refs`** | 本版 breaking：請求體若仍傳 `node_refs` → **400** 未知欄位或明確 `node_refs_removed`（二選一定案） |
| 既有＋新建 | 統一例如 `node_mentions: { id, mode: "ref"\|"create" }[]`，或正文-only token 由 server 解析；**勿**復活平行「只 ref、不 create」的舊欄位名 |
| 正文序列化 | 人讀 raw 內嵌 token（如 `[@ken](node:ken)`／wikilink）vs pill 只存在 UI、raw 仍純文字＋只靠新 JSON —— **須定案一種**，以免 dream／Obsidian 各讀各的 |
| id 規則 | create 時 id＝使用者 `@` 後字串（需 sanitize）；與「常見名加 qualifier」指引如何並存 |
| Dream | prompt：依 mention／create 名單對齊；`create` 本輪 **必須** seed `nodes/{id}/{id}.md`（除非人審前 discard） |

### 搜尋

- Dropdown：先 **keyword／前綴** 打 `GET /memories/nodes` 客戶端濾（node 量小時夠用）。
- 量變大後可接 [vector／語意搜尋](./vector-semantic-search.md)（非本項前置）。

## 非目標（構想階段）

- 本項 **不**做 node rename／merge UI
- 不在 Activities 內編輯 live `{id}.md`
- 不取代 Clarify／Seek 輸入框
- 不強制歷史 events 回填 mention
- **不**保留 `node_refs`「兼容層」給整合方長期使用（若有外部整合，changelog 標 breaking；見 `engram-activities-integration` skill）

## 與「裸 id 撞名」的關係

- Composer **降低**誤指：選 pill＝選 id。
- **不自動解決**「第一個 Ken 已佔 `ken`」：第二個仍須 `@` 成另一 id（如 `ken-college`）或先有 rename 產品；可在 create 流程提示「`ken` 已存在，請改 id 或選現有」。

## 開工前仍須拍板（排進 version 時）

1. raw 正文是否嵌入可解析 mention token，或僅新 JSON 側車  
2. `create` 的 id 校驗／與既有 id 衝突時 UX（拒絕 vs 改成 ref）  
3. Dream 對 create 名單失敗（沒建成）時：警告 vs 硬失敗  
4. Clarify aside／Seek 是否共用同一 composer（預設：**不**，僅 Activities）  
5. 舊 event JSONL 殘留 `node_refs`：忽略 vs migrate 剝除  

## 驗收草圖（將來）

- `@ke` → 可選中既有 `ken` → submit 後 event／API 帶該 id（**無** `node_refs` 鍵）  
- `@tommy`＋確認新建 → dream pending draft 出現 `nodes/tommy/tommy.md`（或定案之 id）  
- `POST /activities` 帶 `node_refs` → 依定案拒絕或忽略（文件寫死）  
- 不按 `@` 的純文字捕捉行為與今日相容（除廢欄位外）
