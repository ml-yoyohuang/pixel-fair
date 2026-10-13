# 增加與更改內容

入口只從 ContentRepository 取 DTO；fixtures 在 `src/data/fixtures/content.ts`。新增創作攤位不需修改 renderer，所有座標以 tile 表示。

## 新增攤位示例

1. 在 seeds 增加穩定 key，例如 `['moon','月亮便當','小月','給夜班的晚餐','novel', ...]`。此 seed 是 Demo authoring helper；實際 DB 將各表分開。
2. 在 locations 增加合法 origin；目前 helper 產生 3 × 2 桌位，anchor 在桌前 `origin + (1,2)`、NPC point 在 `(2,3)`。請先用 NavigationService 驗證無越界、重疊且可達。
3. Circle `circle-moon`、Participation `part-moon`、Work `work-moon`、Exhibit `exhibit-moon`、Slot `slot-moon` 分開；不可用 A13 或 array index 當內容 ID。
4. 更換裝飾 `tableclothId`、`signId`、`propIds`。cloth 色由 palette 定義，props 在 art 中對應可用原創素材；原有骨架共用。
5. 漫畫 preview 指向本機圖片 ID，小說用 paragraphs；取得狀態 sale／free／display 與 new／existing、medium 分離。
6. 免費檔案放 public/assets，manifest 添加 download ID。封面和試閱也需 manifest 同源項目。修改 generator seed 可重建原創封面。
7. 納入某集章企劃時加入 Participation ID，依 requiredCount 設門檻；同創作攤位的多桌只加入一次。

此版本 helpers 以十二攤預設產生展示攤號；超過十二攤時更新 code 的 authoring 策略與區域分類即可，不改遊戲 loop。更正式的資料可直接輸入独立 JSON tables 或 API DTO，不必沿用 seeds。

## 新場景示例

現成 `testScene` 是第二個 16 × 14 小庭院，有兩個桌位與出生點。`npm run dev` 後打開 `/?scene=test`，相同 movement、interaction、repository 與 renderer 工作。它不出現在正式入口。

建立新 SceneDefinition：給 width、height、ground、objects、spawn、npcWaypoints；新 Layout 定義版本，再填 BoothSlot／Assignment，repository.getScene 返回 SceneView。每個公開設施提供合法 anchor；實體物件形成碰撞。加入外部圖片時把来源與許可寫入 ASSET_CREDITS，禁止遠端熱連結。

## 修改獎勵

recipeVersion 需隨配方變更。RewardService 的兩組選項與 reward-card 的固定預留位置配合；舊 RewardSnapshot 保持原樣。使用注入 RNG 做九組 deterministic 驗證，不能在 renderRewardCard 中抽樣。
