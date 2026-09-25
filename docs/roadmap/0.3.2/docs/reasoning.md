# 0.3.2 — WHY

← [INDEX](../INDEX.md)

## 為何現在做

Lite 沒有 approve，Engram「審完再 commit」掛不上。Eric 定案：**每次操作成功就 commit**——比審核流更簡，又保留歷史。

## 為何仍算「薄」

- Program 機械呼叫 git，無語意判斷。  
- 無 remote／push，隱私預設安全。  
- 不引入 dream draft。

## 否決

| 方案 | 為何否決 |
|------|----------|
| 只手動 git | 可做但不達「產品行為」；易忘 |
| 搬 approve 再 commit | 違反 lite 主幹 |
| 每個 skill 自己 commit | 調度分散；難測 |
| distill 每個 session 各 commit | 易留下「已 distill、未出題」中間態；本版定 **job 成功一次** |

## 失敗模式

- commit message 貼正文 → 隱私進 git log。  
- 追蹤 `jobs/` → 噪音與暫態。  
- git 失敗改成 API 失敗 → 使用者以為沒寫入，實際已寫。
