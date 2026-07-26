# Store 以 local git 做 apply 事務（backlog）

← [backlog](./INDEX.md)

> **狀態：** 構想筆記；**不進 0.11.0**。  
> 0.11 多層 chain 仍使用現行 **draft → pending_review → approve／discard**。

## 動機

現行 approve 依賴 `dream/draft/{run_id}/` 投影，再 `commitDraft` 進 live。若 apply 做到一半失敗，要靠 draft／manifest 復原，心智與實作都重。

構想：把 `ENGRAM_HOME`（或資料根）做成 **獨立 local git repo**：

1. Dream／apply **直接改 working tree**（live 檔）
2. 過程失敗 → `git checkout`／`reset` 回到上一 commit
3. 全程成功 → `git commit` 成一版快照

如此可能 **大幅簡化或取消 draft 目錄**，人審改看 `git diff`，誤操作也較易 revert。

## 與 0.11 的關係

0.11 要做 week／month／year rollup + day 目錄分組，已夠大。  
同時更換寫入事務模型會重寫 L1.5 邊界，與 rollup 管線耦合，範圍失控。  
**先把多層 chain + draft 做穩，再單獨開版評估本項。**

## 可能好處

- Apply 中斷可機械復原
- 每次成功 approve＝一個 git commit（時間旅行／diff／blame）
- 手改與 dream 寫入若同 repo，可統一稽核（若政策允許）

## 開放問題（日後討論）

1. 人審（pending_review）看什麼？working tree diff、暫時 branch、還是仍要 staging 區？
2. Dream lock 期間 `POST /capture` 寫 L0／L1：是否進同一 dirty tree？衝突誰優先？
3. Extract／Ask agent 讀的是 dirty tree 還是 `HEAD`？
4. 手改 L2／chain 是否允許？與 dream commit 如何分開訊息／作者？
5. 每個 `ENGRAM_HOME` 一個 repo？`data-demo`／`data-test`／reset 流程？
6. `events.jsonl` 等大檔、頻繁 append 對 git 的成本？
7. 無 git／權限環境（部分 CI、受限 WSL）的降級策略？
8. Discard＝abandon working tree；與「部分 approve」未來需求是否衝突？

## 非目標（預設）

- 不是把記憶推上 GitHub／遠端當同步方案（可另議）
- 不是 0.11 範圍內「順便」刪 draft
- 不是取代 L0 唯附加語意（git 是事務／快照工具，不是事件 log 替代）
