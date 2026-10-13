# V2 驗收紀錄

2026-10-13，Asia/Taipei。測試在此 Windows 工作站執行；Chrome 154.0.8037.98，Playwright 1.64.0，測試 runtime Node 24.19.0。未取得手機真機，以下手機結果是桌機 Chrome 的 viewport 模擬，沒有宣稱 iOS／Android 真機或觸控多指驗證。CIM 不允許讀取 CPU 型號，因此不填造設備型號。

## 最終結果

- TypeScript strict：通過。
- 正式 build：通過，Vite 6.4.4；TypeScript 5.9.3。
- 核心測試：14／14 通過，Vitest 3.2.7。
- 瀏覽器整合：13／13 通過，單 worker 約 1 分鐘。
- 正式產物 smoke：入場、十二攤目錄、三頁漫畫試閱通過；開發 hook 不存在；流程內 pageerror／HTTP 4xx、5xx 均無。
- PNG：實際下載與開圖確認，1600 × 1000，文字、玩家、陪拍夥伴、隨機細節與完成章不互相遮擋。

完整流程從選角、靜音入場、實際走到 A01、閱讀與圖片放大、收藏，走到剩餘五個集章攤位，再走到影印店、領取與下載 PNG；重新整理後獎勵 snapshot 相同，收藏保留。不是以直接寫入六章代替走攤驗證。

## 規格覆蓋

| ID | 驗證方式與結果 |
| --- | --- |
| AC01 | 真實選角、暱稱、靜音、教程／深連結簡短入場，通過 |
| AC02 | 四鄰接路徑單測、實際地面 click／桌前 click／牆碰撞／拖曳 threshold，通過 |
| AC03 | 桌子點擊到 anchor，抵達不開模態，查看開啟，通過 |
| AC04 | 目錄帶路、全半形搜索、鍵盤中止，通過；收藏提供相同 navigateTo |
| AC05 | 12 攤資料、三攤各三頁漫画、兩篇 500～800 字小說、試閱與 Back，通過 |
| AC06 | 模態清路徑，暱稱 WASD／方向鍵不移動，inert 背景與 focus trap，通過 |
| AC07 | 創作攤位／作品各自收藏；refresh 保留，通過；取消按相同穩定 ID 操作 |
| AC08 | 冪等蓋章單測、六攤實際蓋章、已蓋按鈕 disabled，通過 |
| AC09 | 未滿規則拒絕、六章護照、影印店帶路、九個注入 RNG 組合，通過 |
| AC10 | refresh snapshot 一致；blocked storage 中換角仍沿用；PNG 真正下載，通過 |
| AC11 | 壞 JSON／巢狀損壞單測、瀏覽器拒絕 storage 寫入後仍領卡，通過 |
| AC12 | NPC 位置隨時間變化、合法可走格、相同導航服務與獨立 driver，通過；等待區間由實作範圍檢視 |
| AC13 | 靜音 context 為 null；手勢後 running；同一 context；preview gain 40%、mute 保持、設定持久化，通過。未做人工音色實聽評分 |
| AC14 | 服務／公告、咖啡輪替、座位離開、海報／兔子、影印領卡，通過 |
| AC15 | 390×844、360×800、844×390、1280×720，無文件水平 overflow；主要按鈕 ≥44 CSS px，通過。僅 viewport 模擬 |
| AC16 | 初始小說深連結、browser Back、圖片放大子層、未知 ID 回街道，通過 |
| AC17 | repository fail／empty、abort 試閱圖片後重試，通過 |
| AC18 | `?scene=test` 的兩攤庭院實際可帶路，renderer 不改動；fixture anchors 可達單測，通過 |
| AC19 | typecheck／build／14 core／13 E2E／正式 smoke，通過；完整正常流程無資源 404 或 pageerror |
| AC20 | 已開圖檢視桌機／手機／紀念卡：一致暖色點陣、可辨角色與建築、非靜態目錄。美術觀感為人工檢視，不是自動客觀評分 |

## 截圖

| 內容 | 檔案 |
| --- | --- |
| 入場與桌機街景 | [入口](screenshots/entrance-1280.png)、[街景](screenshots/street-1280.png) |
| 手機直向 | [390 街景](screenshots/street-390.png)、[360 目錄](screenshots/directory-360.png) |
| 手機橫向 | [844 街景](screenshots/street-844.png)、[844 目錄](screenshots/directory-844.png) |
| 六章與領卡 | [護照](screenshots/passport-1280.png)、[領卡](screenshots/reward-1280.png) |
| 實際 PNG | [1600×1000 紀念卡](screenshots/reward-card.png) |

## 資源與效能

正式 dist 共 52 檔，176,502 bytes（約 172 KiB），包含所有按需試閱與免費作品。每檔獨立 gzip 合計 62,071 bytes（約 61 KiB）；這是檔案壓縮量測，不是實際主機傳輸大小。JS gzip 29.38 KB、CSS gzip 4.08 KB、HTML gzip 0.44 KB，未引用外部資源，遠低於 8 MB 工程目標。

桌機 1280×720 平滑 RAF 取樣約 57.2 FPS；390×844 在約 4.01 秒取得 228 frames，約 56.8 FPS。原始資料見 [desktop](screenshots/performance.json) 與 [mobile viewport](screenshots/performance-mobile.json)。結果是同一台工作站 Chrome headless，不能推論實際手機效能、長時間發熱或所有裝置保證。

## 已修正與限制

已修正：舊 Node 的測試下載相容問題（使用可用的 Node 24 與已安裝 Chrome）；Windows watcher 對下載 PNG 的 EBUSY（排除 QA／報告目錄）；圖片重試被父層預覽 click 接走（錯誤狀態移到圖片按鈕外）；近距離新路徑、分層關閉、整數縮放、儲存巢狀資料驗證。

V2 可玩功能無已知阻塞。尚未驗證真機 Safari、多指 pinch、音色主觀體感與長時間效能；現有大圖提供放大／縮小／重設作替代。美術是原創程序點陣風格，後續可替換更精細 sprite，不需要改內容或移動服務。

V3 登入／後端、L1 五百攤匯入、V4 多人／聊天／真實交易都按規格保留交界，沒有實作或宣稱容量。沒有 commit、push 或部署。

## 大眾試玩文案更新

對外標題改為「黃昏故事街」，活動稱為「線上原創市集」。目錄與作品標籤採「創作攤位／新作／精選作品／免費作品」，入口、公告、下載檔名、免費短篇、紀念卡與驗收截圖同步更新。全站原始碼、公開素材及正式產物已做文字掃描；穩定 ID 與既有收藏、印章、獎勵紀錄保留。

更新後 typecheck、build、14 項核心測試與 13 項瀏覽器測試全部通過。前面的資源數值為首次 V2 驗收紀錄；新版 JS gzip 約 29.36 KB，仍低於原訂資源目標。

## GitHub Pages 發布準備

使用相對 base 與 BASE_URL 素材網址，補上 main 自動建置／部署 workflow。正式產物在 `/pixel-fair/` 子路徑完成入場、十二攤目錄與三頁漫畫 smoke，無資源或程式錯誤；核心 14 項測試重新通過。發布於使用者後續明確授權後進行。
