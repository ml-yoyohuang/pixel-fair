# 後端學習路線

V2 的 localStorage 是方便體驗的本機狀態，不是安全兌獎系統。不預先選定資料庫，也沒有假登入。

| 階段 | 練習重點 | 本專案接入點 |
| --- | --- | --- |
| 1. 讀取 API | DTO、HTTP status、timeout、重試與取消、404／空資料分離 | ContentRepository → HttpContentRepository |
| 2. 關聯資料與 migration | Venue／Layout／Event、Circle／Participation／Assignment、Work／Exhibit 的 FK；資料 ownership | models 分離既有作品與活動內出展；layout version 不原地覆寫 |
| 3. 寫入與驗證 | 欄位驗證、可見文案作文字、URL 協定檢查、 optimistic locking 防併發覆蓋 | creator API 返回 revision／updatedAt；409 提示重讀 |
| 4. 登入／權限 | session、按活動主辦權限、按 circle 成員權限；不要只藏按鈕 | server endpoint 驗證 ownership；VisitorRepository 替換成 API |
| 5. 圖片儲存 | signed upload、mime／尺寸檢查、origin／CORS 與清理；內容發佈前審核 | asset manifest 與 coverAssetId；PNG 出圖保持可控同源 |
| 6. 審核與版本 | draft → submitted → approved → published；公開資料與修改稿分離 | Participation published DTO 是公開讀取面 |
| 7. 集章／獎勵 | server transaction、唯一約束(event,visitor,campaign)、request idempotency、完成門檻重新驗證 | StampService／RewardService 為規則參考，server 成為唯一權威 |
| 8. 運維與還原 | 程序重啟不失資料、備份、migration rollback、恢復演練、audit log、錯誤率與監控 | durable storage；不把 instance memory 當持久化 |
| 9. 場館配置 | 米／image px／world mapping、CSV 重號／缺漏／重疊／越界／不可達、原子發佈版本 | SceneDefinition、Layout、BoothSlot、Assignment；OCR 要人工校正 |
| 10. 多人房間 | server authoritative movement、節流、容量、disconnect／reconnect、過期角色 | ActorState source remote、新 RemoteActorDriver，按 event／scene／instance 分房 |

先讓 API 可讀，再做 DB；先確認持久化與還原，再加入聊天室。移動高頻快照不每步寫資料庫。聊天另需封鎖、檢舉、管理與保留政策。五百攤與五百在線訪客需要各自負載測試，不由 V2 推論容量。
