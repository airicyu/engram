# 附圖捕捉

**狀態：** 未排程。目錄契約已在 [0.2.0](../0.2.0/INDEX.md)。本檔不是上傳 API 的已定案。

## 題意

人上傳相片（拖放／貼上），檔寫進 `memories/_attachments/uploads/{日}/{檔}`。事件 `raw` 含精確 `![[_attachments/uploads/…]]`。Distill 寫 day chain 時，相關就原樣帶同一 embed（週月年可省略）。Obsidian 開 `memories/` 能看見圖。模型靠人寫的關係文字選材，**不**看像素。

## 可能要定（排進版本時寫進 INDEX）

- 是否要 tmp＋submit 搬檔（Engram 0.29）還是一步寫正式目錄
- 事件要不要 `attachments[]` 與 `## Attachment relationships`
- UI 是否渲染 `![[…]]`
- ingest skill 能否在終端機流程引用已落地檔

## 不要當成題目的一部分

- HEIC、vision／OCR、與 `engram-data` 共用庫
