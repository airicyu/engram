# 0.6.0 HOW

← [INDEX](../INDEX.md)

## Track A — 殼層（P0）

| 步驟 | 內容 |
|------|------|
| A1 | `index.html`：`.shell` 內加 `.atmosphere`（`aria-hidden`） |
| A2 | `style.css`：atmosphere 漸層；`.workspace.stage-locked` opacity／pointer-events 策略（子元素 `data-lock` 仍由 JS 禁用） |
| A3 | 側欄 foot：`status-light` 結構；`app.js` `refreshStatusLight()` 讀 `/status` |
| A4 | `pollJob`／`setControlsBusy` 路徑對 workspace 切 `.stage-locked` |

## Track B — Mention 收口（P0）

| 步驟 | 內容 |
|------|------|
| B1 | 確認 `mention-composer.js` 載入與 `renderEvents` 綁定 |
| B2 | `shell-ui.test.ts` 煙霧 |

## Track C — 活躍分（P1）

| 步驟 | 內容 |
|------|------|
| C1 | `server/node-score.ts`：parse frontmatter `activity_score`；clamp 0–100 |
| C2 | `listNodes`／`readNode` 帶 `activity_score` |
| C3 | `web/app.js` `loadNodeDetail` 寫 `#detail-meta` |
| C4 | 虛構 demo 一 node 加 frontmatter；unit test |

## Track D — Import score（P1）

| 步驟 | 內容 |
|------|------|
| D1 | `import-from-engram.ts`：nodes 複製後，若 `score.yaml` 存在，讀 `score` 或 `activity_score`，merge 進 `.md` frontmatter |
| D2 | `import-from-engram.test.ts` 虛構 fixture |

## Track E — 真人匯入指引（P2，僅文件）

| 步驟 | 內容 |
|------|------|
| E1 | `docs/data-spec.md` 匯入段補 **檢查清單**：(1) 新空目錄 `--to`；(2) `bun run import:engram --from <engram-store> --to <lite-store>` dry-run；(3) `--yes` 寫入；目標已有內容用 `--force`；(4) 設定 `ENGRAM_LITE_STORE_DIR` 或 `.env`；(5) `bun run dev` 驗收 chain／nodes／pool／附圖 |
| E2 | 勿 `--to` 指 Engram 本庫；勿把匯出目錄 commit；真人正文勿寫進測試／fixture |

## 順序

A → B → C → D → E；每 Track 結束跑相關測試；全部結束 `bun test`。
