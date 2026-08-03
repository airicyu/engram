# Backlog — Vector／語意搜尋

← [backlog INDEX](./INDEX.md) · 歷史：prototype／0.2.0 標 **out of scope** embedding

## 題目

記憶量成長後，關鍵字 `GET /memories/search?q=` 不夠用；需 **語意／向量** 檢索（embedding + 近鄰），加速 Seek、Memory 瀏覽與 Ask 的 context 選取。

## 現況（0.20）

- Search 為 **文字匹配**（scope：`l1,nodes,chain,future`）
- Ask agent 自行讀檔；無預建 embedding index
- Store 無 `embeddings/` 或向量 DB 契約

## 粗範圍（將來定案）

| 面向 | 選項（待拍板） |
|------|----------------|
| **索引對象** | node `what.md`、chain summaries、short-term、activities snippet |
| **儲存** | store 內檔案 vs 側車 SQLite／lance；是否進 git |
| **更新** | approve 後增量；全量 rebuild CLI |
| **API** | `GET /memories/search` 加 `mode=semantic` 或獨立端點 |
| **模型** | 本地 vs API embedding；維度與版本戳 |

## 非目標（構想階段）

- 取代 keyword search（應 **混合** rank）
- 多模態 image embedding（見 [activity-images](./activity-images.md)，可後續接軌）
