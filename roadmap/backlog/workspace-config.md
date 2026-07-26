# Data workspace config（backlog）

← [backlog](./INDEX.md)

> **狀態：** 構想筆記；尚未排進版本。  
> 觸點：每個 `ENGRAM_HOME`／data folder 的偏好，與 server 進程級 env 分開。

## 動機

同一台 Engram server 可指向不同 data folder（例如 `data/`、`data-demo/`、另開的個人庫）。  
不同庫往往是**分開的記憶世界**，可能需要不同偏好——不必改 server `.env` 或重啟才能切換。

構想：在 data folder 根放一份 **workspace config**（名稱待定，例如 `engram.workspace.yaml`／`engram.json`），只作用於該庫範圍內的讀寫與 dream／chain 產生內容。

## 目前想到的欄位

### 1. Timezone

- IANA zone（與現行 `ENGRAM_TZ` 同語意：日曆日、事件時間、chain 關帳邊界）。
- **未定義** → 沿用 Engram server 系統設定（`ENGRAM_TZ`，預設 `Asia/Hong_Kong`）。
- 有定義 → 該 workspace 的 capture／dream／chain／future-sight／`/status` 日曆語意以 workspace 為準（細節開版時定：`/status.timezone` 報哪一層）。

### 2. 記憶寫入語言偏好

- 控制 **寫入 memory chain 與 node**（以及 dream extract 產出的長期理解）的內容語言。
- 初版枚舉構想：`zh-Hant`（繁中）／`zh-Hans`（簡中）／`en`。
- 與 workbench **UI shell i18n** 分開：UI 可切換顯示語言；本欄只約束**記憶本體**怎麼寫。
- **未定義**時行為待定（沿用 server 預設、或沿用現行 extract prompt 慣例）。

## 可能好處

- 多庫並存：港／台繁中庫、簡中庫、英文庫不必搶同一 `ENGRAM_TZ`／寫作語言
- Preference 跟著資料走，搬移／備份 data folder 時設定不丟
- Server env 維持「進程預設」；workspace 覆蓋「這一庫」

## 開放問題（日後討論）

1. 檔名與格式：YAML vs JSON？是否允許註解？
2. 誰寫入／誰讀：僅人手編輯，還是要 `GET|PUT /workspace/config`？
3. Workspace timezone 與虛擬時鐘（`PUT /clock`）的互動：clock 是 server 級還 per-workspace？
4. Extract／Ask prompt 如何注入語言偏好（固定 instruction vs 可覆寫）？
5. 既有庫無 config 檔的遷移與預設值文案
6. 是否還有其他 per-workspace 欄位值得一併預留（例如 agent runner 覆寫、display name）——**預設不加**，等真有需求再擴

## 非目標（預設）

- 不是多租戶 auth／權限模型
- 不是取代 server `.env`（埠、runner、allow virtual clock 等仍屬進程）
- 不是把 UI i18n 與記憶寫入語言綁死成同一個開關
