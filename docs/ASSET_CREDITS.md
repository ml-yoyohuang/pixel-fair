# 素材與來源

沒有外部圖片、錄音、字型下載或熱連結。所有創作文案均為本 Demo 原創虛構內容。未使用《寶可夢》的角色、地图或曲目。

| 資產 | 來源與方式 | 用途 |
| --- | --- | --- |
| 十二攤介紹／漫畫台詞／兩篇小說／免費作品短篇 | 本專案原創繁體中文 | 攤位、試閱與真正可下載 txt |
| 六款玩家與店番 sprite | `src/game/art.ts` 原創 Canvas 像素矩形、四向／四相步行 | 場景、選角、紀念卡 |
| 建築、屋頂、遮棚、書桌、植物、腳踏車、售賣機、燈串、旗幟 | 同上程序點陣 | 可辨識原生 tile 與物件 |
| 十二封面、三攤各三頁漫畫、插畫與小物圖 | `scripts/generate-assets.mjs` 原創 SVG、清晰文字與 crispEdges 圖案 | public/assets 與 manifest；無圖片裁切 |
| 陪拍貓／狗／鳥及新作紙袋／咖啡／傳單 | art 與 reward-card 的程序繪圖 | 九種等機率紀念卡組合 |
| BGM | `src/audio/manager.ts` 原創 64 拍旋律、四和弦低音／三音伴奏、0.28 秒節拍循環 | 柔和正弦／三角波，約 18 秒一輪 |
| 腳步、確定、返回、蓋章、揭曉 | 同上原創振盪器音效 envelope | 獨立使用者音量與限頻 |
| UI 與圖示 | 本專案 CSS、文字標籤、Canvas 圖形 | 可讀繁體中文、手機 44 px 操作區 |
| 字型 | 作業系統既有 Microsoft JhengHei／PingFang TC／system-ui／serif | 不打包或再散佈字型 |

原創素材的專案內使用不依賴第三方媒體授權。套件的各自授權隨 node_modules 發行，確切版本在 package-lock.json；Vite／TypeScript／Vitest／Playwright 為開發與測試工具，不包含既有遊戲媒體。
