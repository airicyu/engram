# Backlog — Vector／語意搜尋

← [backlog INDEX](./INDEX.md) · 歷史：prototype／0.2.0 標 **out of scope** embedding

## 題目

記憶量成長後，關鍵字 `GET /memories/search?q=` 不夠用；需 **語意／向量** 檢索（embedding + 近鄰），加速 Seek、Memory 瀏覽與 Ask 的 context 選取。

## 現況（至 0.39）

- Search 仍為 **文字匹配**（`scope`：`l1,nodes,chain,future`；預設四者）
- Ask agent 自行讀檔；無預建 embedding index
- Store 無 `embeddings/` 或向量 DB 契約
- Node 主檔是 `nodes/{id}/{id}.md`（standing understanding；**不是**舊 `what.md`）
- Activity 附圖已在 [0.29.0](../0.29.0/INDEX.md)；本項不依賴 vision／image embedding

## 粗範圍（將來定案）

| 面向 | 選項（待拍板） |
|------|----------------|
| **索引對象** | node 主檔、chain summaries、short-term、activities snippet |
| **儲存** | store 內檔案 vs 側車 SQLite／lance；是否進 git |
| **更新** | approve 後增量；全量 rebuild CLI |
| **API** | `GET /memories/search` 加 `mode=semantic` 或獨立端點 |
| **模型** | 本地 vs API embedding；維度與版本戳 |

## 非目標（構想階段）

- 取代 keyword search（應 **混合** rank）
- 多模態 image embedding（可後續接 0.29 附件，不在本構想內）
