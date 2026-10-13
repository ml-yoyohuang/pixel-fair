# 黃昏故事街｜故事市集

線上試玩：[黃昏故事街](https://ml-yoyohuang.github.io/pixel-fair/)。

可走動的繁體中文單人點陣遊戲。十二個虛構創作攤位、六款角色、六名 NPC、漫畫與小說試閱、收藏、集章與個人化紀念卡。所有文字與美術均為本專案原創；販售標籤僅供 Demo，沒有付款。

## 啟動

建議 Node.js 22.12+ 或 24 LTS。Vite 6 可建置於 Node 20，但目前測試工具不適用於本機舊的 Node 20.0；請使用更新的 Node。

```powershell
npm ci
npm run dev
```

開啟终端機顯示的本機網址，預設 `http://127.0.0.1:5173/`。

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

瀏覽器驗收需先啟動 dev server，再執行 `npm run test:e2e`。Windows 預設使用已安裝的 Google Chrome。其他系統設定 `PLAYWRIGHT_CHROME_PATH` 為 Chromium 執行檔路徑；可用 `PLAYWRIGHT_BASE_URL` 改測試網址。測試會在 `docs/screenshots` 產生版面、PNG 卡片與效能量測，在 `playwright-report` 產生報告。

## 怎麼玩

1. 選擇人類、貓、狗或兔角色；可填暱稱，選靜音或開啟聲音。
2. 點地面走路。點攤桌會走到桌前，再按「查看」閱讀。
3. 目錄能搜尋創作攤位、攤號、作品名，篩選新作／免費作品／展示／集章，收藏與帶路。
4. A01、A03、A05、A07、A09、A11 的攤位選單可主動蓋章。集滿六枚後前往影印店。
5. 第一次領卡會固定角色、暱稱、陪拍動物與街角細節；可重開並下載 1600 × 1000 PNG。

桌機：方向鍵／WASD 移動、E／Enter 查看、Esc 逐層返回。點擊 UI 不會穿透到地圖。公共店家在門口互動；書店共用目錄，咖啡店可聊天與坐下，服務處可重看教學。

## 儲存與連結

使用帶版本與 eventId 的 localStorage。只存輕量狀態；停步時節流儲存位置。清除網站資料或換裝置會失去進度。無法寫入時會提示，仍保留當次記憶體結果與下載能力。換角色不會清掉收藏或重抽紀念卡。

Hash 路由不需要靜態主機 history fallback：

```text
/#/event/twilight-only
/#/event/twilight-only/booth/part-mail
/#/event/twilight-only/booth/part-tide/work/exhibit-tide/preview
```

未入場的深連結先選角，再開目標內容。瀏覽器 Back 與 Esc 可回上一層。

## 開發驗證模式

僅 dev 模式提供 `?scene=test` 極簡第二場景、`?fail` 資料讀取錯誤、`?empty` 空目錄；正式建置不啟用。圖片試閱按需載入，封面有預載進度與失敗重試。原創素材可用 `node scripts/generate-assets.mjs` 重建。

架構與擴充見 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，新增內容見 [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)，實測與限制見 [docs/QA_REPORT.md](docs/QA_REPORT.md)。

## GitHub Pages 發布

推送至 `main` 會觸發 `.github/workflows/deploy.yml`，以 Node 24 安裝 lockfile 依賴、執行核心測試、建置與發布 `dist`。GitHub Pages 的來源使用 GitHub Actions。

Vite 使用相對 base，封面、試閱與免費下載經 `BASE_URL` 組成網址，可部署在 `/pixel-fair/` 子路徑。Hash 深連結不需要主機 rewrite。首次上線的本機進度與開發伺服器分屬不同 origin，不會自動移轉。
