# 架構與資料交界

## 技術與座標

Vite 6 + strict TypeScript + 原生 Canvas 2D。遊戲與 DOM 面板分離。Canvas 支援低解析點陣、整數 3／4 倍放大、相機 clamp、腳部排序；不使用概念圖作背景。角色素材約 16 × 24 px，每 tile 16 px。所有模型使用 world tile units，只有 art／renderer 轉 pixel。

地圖由 SceneDefinition 的 ground、objects、spawn、npcWaypoints 和 SceneView 的 slots／assignments 建立。街區 52 × 32 tiles，主街六攤、廣場四攤、支巷兩攤；第二個 test-yard fixture 用相同 engine 驗證。

## 模組

| 模組 | 責任 |
| --- | --- |
| SceneRenderer / art | 地面快取、點陣建築、家具、攤桌、四方向角色與前後排序；攝影機與縮放 |
| NavigationService | 四鄰接 BFS，禁止斜向穿角，碰撞與邊界檢查；V2 小地圖足夠，未來可替換 A* |
| MovementController | 每秒 3.6 tiles、delta time、替換路徑、鍵盤取消導航、停止／抵達回呼 |
| InputAdapter | Pointer threshold 由 engine 處理；鍵盤方向／互動，輸入框不攔截；未來方向鈕接 direction intent |
| InteractionController | 桌前 anchor、目標優先、最近可互動對象，遠處点擊只帶路 |
| NpcController | 相同導航、旁邊停留點、步行／等待輪替，無玩家碰撞；數量 0／3／6 |
| StreetGame | simulation、visibility 暫停、modal 清空意圖、回呼整合與 destroy 清理 |
| ContentRepository / MockRepository | Promise 內容讀取、開發錯誤／延遲／空資料，UI 和 renderer 不 import fixture |
| VisitorRepository | event-scoped schemaVersion 2 本機資料、收藏、儲存失敗提示 |
| StampService | 參與者驗證、冪等收集、去重計數、多企劃規則 |
| RewardService | 注入 RNG／時鐘；第一次保存 snapshot、固定兩個獨立三選項；render 不抽獎 |
| AudioManager | 唯一 AudioContext、結構化循環、獨立音量、試閱 40% duck、背景暫停 |
| UIRouter / StreetApp | hash、面板棧、focus trap、分層 Back、選角、搜尋與閱讀 |

主要事件透過 typed 方法與回呼：`navigate`、`onArrive`、`onStop`、`onNearby`、`onInteraction`、`onPosition`。業務層不保存 DOM／Canvas／AudioContext。沒有 WebSocket、API 認證或重型後端。

## 模型與 DTO

完整型別在 `src/domain/models.ts`。Venue 代表場館；Layout 綁 venue、版本與尺寸；SceneDefinition 包含美術物件與碰撞來源；BoothSlot 是特定 layout 的桌位；EventView 引用 venue、layout、scene 與日期／時區／公告。

Circle 為創作者身份；Participation 是本次參展文案／店番／装飾；Assignment 對應 participationId 與多個 slotIds。Work 保存原作品；Exhibit 分別保存 release、availability、priceLabel、downloadAssetId 與 demoOnly。

BoothSummary／BoothDetail = Participation + Circle + BoothSlot[] + WorkDetail[]。WorkDetail = Work + Exhibit + author。SceneView = definition + slots + assignments。StampCampaign 按 Participation 收集，不按桌位重複集章。RewardSnapshot 記錄 event、campaign、issuedAt、avatarId、nicknameSnapshot、companionId、detailId、recipeVersion。

ActorState.source 支持 local／npc／remote。V2 只建立 local 與 npc；未來 RemoteActorDriver 接入與 NPC driver 分離，不把店番當作在線真人。

## 狀態與路由

點攤位 → 合法 anchor → 面向上 → 顯示唯一附近提示 → 查看開面板。模態開啟清空路徑與鍵盤；關閉不恢復舊路徑。按方向键取消導航。visibilitychange 重設 frame 時間，頁面隱藏不更新模擬。

入場與換角不清空進度。獎勵先寫入記憶體 snapshot，再嘗試持久化，最後顯示；儲存失敗不再次抽樣。清除記錄有獨立二次確認。localStorage key = `fan-street:v2:<eventId>`。

Hash 深連結建立合理的父層 history。圖片放大是 preview 的子層；Back：大圖 → 試閱 → 作品 → 攤位。未知 ID 提供回街道。

## 未來交界

把 MockRepository 換成 HTTP adapter；把 VisitorRepository adapter 改成訪客 API；保留 DTO，不讓渲染器依賴 DB。伺服器重新驗證投稿、參展、印章與獎勵唯一性。場館匯入先做米／圖片／world mapping，不能把真實米數當作 tile。多人 driver 使用遠端位置快照，不每步寫資料庫。

V2 不保證五百攤或多人容量；未做場館編輯器、身份驗證、真實聊天或付款。
