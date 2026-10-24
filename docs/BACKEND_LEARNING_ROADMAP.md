# 後端學習路線

這份路線記錄目前原型的實際狀態。管理後台第一版程式已建立；目前尚未接上真實 Supabase 開發專案，因此登入、持久化和資料庫安全規則仍待實際環境驗收。V2 的 localStorage 只是本機體驗狀態，不是安全兌獎系統。

## 目前進度

- 已完成程式雛形：前台有 `HttpContentRepository` 和 Supabase 公開讀取 adapter；Vite 開發伺服器保留同契約的 fixture API。
- 已完成程式雛形：Supabase PostgreSQL migration 包含文件驗證、跨文件引用、原子匯入、revision 條件更新、操作紀錄與 RLS。這是 JSONB 文件表加延後 trigger 驗證，尚非正規化原生 foreign keys。
- 已完成程式雛形：管理頁含 Supabase Auth 密碼登入、TOTP MFA、記憶體 session、管理者 allowlist、CRUD、草稿／發布、匯入／匯出與 audit 瀏覽／復原。
- 尚待完成的里程碑：建立隔離的 Supabase 開發 project，套用 migration，建立 allowlist 管理者，匯入 Demo 文件，逐項驗收匿名讀取、草稿隔離、非管理者拒絕、未完成 MFA 拒絕、管理者 CRUD 和 audit 復原。沒有實際 project 前，不能宣稱端到端或資料庫權限已驗收。

| 階段 | 練習重點 | 本專案接入點 |
| --- | --- | --- |
| 1. 讀取 API | DTO、HTTP status、timeout、重試與取消、404／空資料分離 | ContentRepository → HttpContentRepository |
| 2. 關聯資料與 migration | Venue／Layout／Event、Circle／Participation／Assignment、Work／Exhibit 的參照完整性 | migration 以 JSONB 文件表與 deferred trigger 驗證；下一步先在 Supabase 開發 project 實際套用、匯入和驗證 |
| 3. 寫入與驗證 | 欄位驗證、可見文案作文字、URL 協定檢查、optimistic locking 防併發覆蓋 | 管理頁檢查欄位，資料庫再驗證；更新以 revision 條件避免舊頁覆寫 |
| 4. 登入／權限 | session、管理者 allowlist、MFA、RLS，不只藏按鈕 | 管理頁已接 Supabase Auth + TOTP + `admin_users` + RLS；待真實 project 驗收 |
| 5. 圖片儲存 | signed upload、mime／尺寸檢查、origin／CORS 與清理；內容發佈前審核 | asset manifest 與 coverAssetId；PNG 出圖保持可控同源 |
| 6. 審核與版本 | draft → submitted → approved → published；公開資料與修改稿分離 | Participation published DTO 是公開讀取面 |
| 7. 集章／獎勵 | server transaction、唯一約束(event,visitor,campaign)、request idempotency、完成門檻重新驗證 | StampService／RewardService 為規則參考，server 成為唯一權威 |
| 8. 運維與還原 | 程序重啟不失資料、備份、migration rollback、恢復演練、audit log、錯誤率與監控 | durable storage；不把 instance memory 當持久化 |
| 9. 場館配置 | 米／image px／world mapping、CSV 重號／缺漏／重疊／越界／不可達、原子發佈版本 | SceneDefinition、Layout、BoothSlot、Assignment；OCR 要人工校正 |
| 10. 多人房間 | server authoritative movement、節流、容量、disconnect／reconnect、過期角色 | ActorState source remote、新 RemoteActorDriver，按 event／scene／instance 分房 |

接下來先做 Supabase 開發環境接線與安全驗收，再處理正式備份／還原演練。管理後台目前的 audit log 可看 before/after，並可用 revision 條件復原單筆異動；這不等同於資料庫備份。再加入訪客帳號、投稿、印章或獎勵前，需另設 server-side 權限與交易。移動高頻快照不每步寫資料庫。聊天另需封鎖、檢舉、管理與保留政策。五百攤與五百在線訪客需要各自負載測試，不由 V2 推論容量。
