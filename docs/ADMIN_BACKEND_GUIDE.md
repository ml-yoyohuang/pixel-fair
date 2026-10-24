# 管理後台與後端：從零開始

本專案採用 Supabase：它提供託管 PostgreSQL、管理者登入與 API，前端不用自行保管資料庫密碼，也不必先架一台長駐伺服器。正式環境的前台仍可放 GitHub Pages；Supabase 提供雲端資料服務。

## 先認識四個零件

- **PostgreSQL**：資料真正儲存的位置。重新整理、關閉瀏覽器或換電腦，資料都還在。
- **Auth**：核對管理者帳號與密碼，並提供第二步驟驗證（MFA）。本專案不自行儲存密碼。
- **RLS**：資料庫內的門禁。每個請求到資料庫時都會檢查使用者身分與權限，不能只靠管理頁把按鈕藏起來。
- **Migration**：可重複執行、可檢視的 SQL 版本檔，記錄資料表和安全規則如何建立。資料庫變更先寫在檔案裡，再套用到專案。

官方參考：[Supabase RLS](https://supabase.com/docs/guides/database/row-level-security)、[Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)、[Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)。

## 本專案已建立的第一版

`supabase/migrations/202610240001_content_admin.sql` 建立內容文件表、管理者 allowlist 和唯讀 audit log。資料庫檢查必要欄位、類型、URL 協定及跨文件引用；引用規則在 transaction commit 時執行。`/admin.html` 有登入、TOTP MFA、一般欄位表單、複雜資料的進階 JSON 編輯、新增／更新／刪除、草稿／發布、JSON 匯入、備份下載、異動紀錄與安全復原。管理者登入後可管理備援驗證器，但至少要保留一個已驗證驗證器。簡單欄位不需要手動寫 JSON；引用 ID 欄位會提示現有資料；座標和地圖區塊仍以 JSON 編輯。整批匯入由資料庫單一 transaction 完成。管理 session 只存在記憶體；重新整理後要重新登入。網站前台也可讀取 Supabase 中已發布的資料。沒有 Supabase 設定時仍是 Demo 模式。

`npm run export:supabase-seed` 會把現有 Demo 內容整理成 `supabase/seed-content.json`，在管理後台登入並完成 MFA 後，用「匯入 JSON」載入開發資料。此檔案已加入 `.gitignore`，匯出資料不要推送到公開儲存庫。匯入前會逐筆檢查類型、必要欄位、重複 ID、單筆大小和活動 ID；跨資料引用則由資料庫再次驗證。管理頁依資料類型提供一般欄位、巢狀 JSON 範本與欄位驗證；可用備份下載匯出目前文件。

管理者名單不允許透過瀏覽器自行新增。管理者 session 必須完成 MFA（JWT 的 `aal2`），才可透過 RLS 寫入。這是縱深防禦：Auth 確認帳號、MFA 確認第二因素、`admin_users` 控制誰是管理者、RLS 在資料庫阻擋未授權操作。

## 你需要在 Supabase Dashboard 做的一次性設定

1. 到 Supabase Dashboard 建立一個 project。先用開發 project；選離主要訪客較近的 region。建立資料庫密碼時用密碼管理器保存，這個密碼之後不要放在網站設定。
2. 打開 **Authentication → Users**，建立你的管理者帳號。再到 **Authentication → Providers / Sign In** 關閉公開 email sign-up；後台不提供註冊頁，管理者由你在 Dashboard 建立。
3. 打開 **SQL Editor**，建立新 query，貼上 `supabase/migrations/202610240001_content_admin.sql` 全文並執行。這個檔案會建資料表、資料驗證、引用檢查、audit log 和 RLS policy。
4. 到 **Authentication → MFA** 確認 TOTP authenticator enrollment 與 verification 都啟用，並將管理者 MFA 設為必須。Supabase Dashboard 可控制 MFA enrollment 與 challenge/verification API；若 verification 關閉，後台無法完成第二步登入。後台第一次登入會顯示 QR code；用驗證器 App 掃描並輸入 6 位數代碼。官方流程說明：[Supabase TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp)。
5. 回到 **Authentication → Users** 點開自己的使用者，複製 user UUID。到 SQL Editor 執行下面指令，把 `貼上你的 UUID` 替換成實際 UUID：

   ```sql
   insert into public.admin_users (user_id)
   values ('貼上你的 UUID');
   ```

6. 到 **Project Settings → API Keys** 複製 Project URL 和 `sb_publishable_...` key。在專案根目錄將 `.env.example` 複製為 `.env.local`，填入：

   ```dotenv
   VITE_SUPABASE_URL=https://你的專案.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_你的公開key
   ```

   然後執行 `npm ci`、`npm run dev`，開啟 `http://127.0.0.1:5173/admin.html`。資料庫密碼和 Supabase secret key 都**不要**放入 `VITE_` 變數或前端檔案。

7. 開發站確認成功後，要讓 GitHub Pages 讀雲端內容，在 GitHub repository **Settings → Secrets and variables → Actions → Variables** 建立 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`。這兩個值是刻意公開的 browser 設定，workflow 只在 build 時注入。不要建立或注入 Supabase secret key。
8. 正式使用前檢查 anon 角色只能讀 published rows，且不能寫入、讀取 `admin_users`、讀取 audit log 或修改內容。

## 為什麼不能只靠登入

「已登入」只代表知道是哪個帳號，並不自動代表有權限。此專案先採單一管理者 allowlist；RLS policy 要求該 user UUID 在 `admin_users`，且 JWT `aal` 為 `aal2`。後續如果新增不同權限的人（例如只能編輯內容、不能發布），再新增明確角色與 policy；不要使用前端傳來的 `role` 欄位當授權依據。

## 建立資料的順序

每筆資料都有自己的穩定 `id`，引用其他資料時儲存對方的 ID。資料庫會阻止缺少引用目標或跨活動串接。場景、場地與攤位尺寸限制在每邊 1 到 128 格；攤位位置、互動點和 NPC 停靠點也必須落在場地配置邊界內，避免錯誤座標讓場景顯示不完整。活動時間請使用帶時區的 ISO 日期，例如 `2026-11-01T10:00:00+08:00`；結束需晚於開始，時區使用 `Asia/Taipei` 這類 IANA 名稱。用後台逐筆建立時，建議依序建立並發布：

1. 場館、創作團體、場景。
2. 場地配置（引用場館）。
3. 活動草稿（引用場館、配置、場景）。
4. 攤位位置、參展資料、作品。
5. 位置分配、出展作品、集章活動。
6. 最後發布活動。已發布活動至少要有一個已發布集章活動。

若整批 JSON 匯入，資料庫會用單一 transaction 檢查所有引用；失敗時整批不會寫入，訪客也不會看到載入一半的資料。

`assignments.slotIds` 和 `campaigns.participantIds` 都是 ID 陣列，每個 ID 在同一筆資料中不可重複；集章門檻只會按不同參展者計算。資料庫也會再次驗證，不會只依賴管理頁的提示。

### 編輯場景的 JSON 範例

`ground` 是地面區塊，`objects` 是建築、樹、長椅等可見物件，`npcWaypoints` 是 NPC 可以走到的位置。每個座標都從左上角開始，`x` 往右增加、`y` 往下增加：

```json
{
  "id": "small-garden",
  "width": 16,
  "height": 12,
  "spawn": { "x": 2, "y": 8 },
  "ground": [
    { "x": 0, "y": 0, "width": 16, "height": 12, "kind": "plaza", "label": "小廣場" }
  ],
  "objects": [
    { "id": "tree-west", "kind": "tree", "origin": { "x": 4, "y": 3 }, "width": 2, "height": 3 }
  ],
  "npcWaypoints": [{ "x": 7, "y": 8 }]
}
```

每個 `objects` 的 `id` 在同一場景內不可重複。位置和尺寸不能超出場景邊界；`ground.kind` 可用 `street`、`plaza`、`alley`。完整可用的物件種類列在 `src/domain/models.ts` 的 `SceneObject` 型別中。儲存前，管理頁和資料庫會各自檢查一次這些規則。

## 接下來實際完成與驗收

目前程式和 migration 已有欄位驗證、MFA 管理登入、RLS、revision 條件更新、原子匯入、append-only audit log 與單筆異動復原。這些尚未在真實 Supabase project 執行，所以目前是已寫好、未端到端驗收。關聯採 JSONB 文件表加延後 trigger 驗證，並非原生 foreign key。

1. 建立隔離的開發 project，套用 migration；先匯入 Demo 資料。資料庫拒絕時整份匯入會 rollback，請查看管理頁錯誤訊息並修正資料。
2. 用登出狀態確認訪客只讀到已發布文件；用一般登入但未完成 MFA 的帳號確認不能寫入；用非 allowlist 的 MFA 帳號確認不能寫入；用 allowlist 且完成 MFA 的管理者驗證新增、更新、刪除、發布、匯入、匯出、audit 和復原。
3. 驗證操作紀錄確實保存 before/after 快照、顯示 actor 與時間；用舊 revision 嘗試儲存，確認畫面提示資料已變更而不覆蓋新版本。先在測試資料操作復原。
4. 上正式資料前設定資料庫備份，另行下載管理頁 JSON 備份，並實際演練還原；檢查管理員 MFA recovery、HTTPS、自訂網域與錯誤監控。

備份和 audit log 用途不同：audit 可查看或復原單筆文件異動；JSON 匯出可備份內容文件，但不含帳號與資料庫設定。誤刪資料的復原會使用原 ID，若該 ID 已重新建立就會停止；一般編輯和刪除使用 revision 條件更新，避免舊分頁默默覆蓋新內容。批次匯入會覆寫相同 event、類型和 ID 的文件，開始前請檢查匯入檔並留存備份。

## 安全維護原則

- 資料庫只允許 HTTPS；production secrets 只放 Supabase/hosting 的 server-side secret store。
- 管理工作階段 token 僅留在頁面記憶體；OWASP 也建議不要把 session/token 放入 `localStorage` 或 `sessionStorage`，因為同源腳本可以讀取它們（[Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)）。
- 每張 exposed table 都要啟用 RLS，且逐項檢查 GRANT。RLS policy 不會自動撤銷既有 table grants。
- 任何公開資料先 `is_published = false`，管理者檢視後才發布。下架用取消發布，不以刪除作為日常流程。
- 每次新增、修改或刪除都由資料庫 trigger 寫入 before/after audit 快照；revision 條件避免舊頁覆寫新資料，且可用最新紀錄嘗試復原單筆異動。正式使用前仍需驗證紀錄、權限與復原行為。
- 定期匯出／還原演練。資料庫備份不等於已驗證可以復原。

本專案的 migration 尚未連到真實 Supabase 專案，也未經 SQL policy 測試；不要把它視為已完成 production security。先建立隔離的開發 project，逐步完成後續接線與驗收。
