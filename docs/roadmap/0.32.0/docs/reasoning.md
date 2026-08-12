# 0.32 — Reasoning

← [INDEX](../INDEX.md) · [mention-contract](./mention-contract.md)

做什麼以 INDEX／mention-contract 為準；本檔只留 **為何** 與否決方案。若要改已定案，須先回答「原本要防的失敗模式是否仍成立」。

---

## 為何廢 `node_refs`，改 raw token

- **失敗模式：** 側車 id 列表與敘事分離 → 人填了正文沒填 refs（或相反）→ dream 仍靠猜。實際產品上該欄幾乎無人用。
- **否決：** UI 做 mention 但 API 仍叫 `node_refs` 長期兼容 → 兩套真相，整合方與 UI 繼續分裂。
- **選定：** 正文內嵌 `[@…](node:…)`／`node-create:`＝人讀、審計、Obsidian 剪貼、bot 都能同一字串。

## 為何不用「純 JSON `node_mentions`、raw 無 token」

- 重演側車問題：列表與句子再度脫節。
- Bot 雖可只打 JSON，但個人記憶原型優先 **可讀 raw**；無 UI 的整合方一樣能在 raw 寫 token（INDEX #26）。

## 為何 create 撞 id 要拒絕、不自動改 ref

- Composer 目的是**消歧**。自動改 ref 會讓人以為「新建了 tommy」，實際掛到舊 node。
- 已存在時正確動作是：**選現有 pill**，不是靜默改寫意圖。

## 為何漏建只軟警告

- 與 Structure notes／0.31 summary lint 一致：主路徑用 mock＋phases 鎖住；偶發模型漏建不應讓整輪 approve 卡死。
- 硬失敗會放大 agent 不穩定性，傷害 consolidate 節奏。

## 為何本版不碰 Clarify／Seek

- 場景語意不同（補問答覆／檢索問答）；共用 composer＝UI＋契約膨脹。
- Activities 是「寫入 L0」的唯一人機入口；先把這一處做對。

## 為何舊 `node_refs` 忽略、不 migrate

- 預期無依賴；掃庫改 JSONL 風險＞收益。
- 新請求 400 已切斷寫入；讀忽略即可。

## 為何 activity 不用 P1 wikilink 當 token

- P1 是 **vault 內 node 主檔** 路徑約定；activity 是 L0 事件流。
- 分開後：捕捉用短 link token；沉澱進 L2／chain 再用 P1（0.28／0.31），避免 L0 與 vault 相對路徑語意搅在一起。
