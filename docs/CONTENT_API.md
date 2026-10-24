# 公開內容 API 接點

前台可用 `VITE_CONTENT_API_URL` 指向符合本契約的 JSON API。未設定時仍使用內建 Demo fixture。API base URL 可含 `/api/v1` 等前綴；以下路徑會接在 base URL 後。

| Method | Path | Response DTO |
| --- | --- | --- |
| GET | `/events/{eventId}` | `EventView` |
| GET | `/scenes/{sceneId}` | `SceneView` |
| GET | `/events/{eventId}/booths` | `BoothSummary[]` |
| GET | `/events/{eventId}/booths/{participationId}` | `BoothDetail` |
| GET | `/events/{eventId}/works/{exhibitId}` | `WorkDetail` |
| GET | `/events/{eventId}/campaigns` | `StampCampaign[]` |

回應應使用 `application/json`，DTO 欄位與 `src/domain/models.ts` 相同。找不到資源回傳 404；其他非 2xx 會顯示 HTTP 狀態。5xx 與網路錯誤預設最多重試一次；每次請求逾時為 8 秒。瀏覽器跨網域 API 需允許此網站的 CORS origin。

## 本機接線

本機 Vite 開發伺服器已提供記憶體版 API。在專案根目錄建立 `.env.local`：

```dotenv
VITE_CONTENT_API_URL=/api/v1
```

執行 `npm run dev` 後，前台會呼叫同源 `/api/v1`；也可直接開 `http://127.0.0.1:5173/api/v1/events/twilight-only` 查看 JSON。移除此設定即可讓前台直接使用內建 Demo repository。此值會編入前端 bundle，只能放公開 API base URL，不能放密鑰。現在只有公開內容 GET；訪客進度、身份、投稿、印章與獎勵尚未改接伺服器。

這個 Vite middleware 只是開發用 API 原型，資料仍從現有 fixture 即時組合，沒有持久化，也不會包含在靜態部署產物中。正式環境需另建可部署的 API process，再讓 `VITE_CONTENT_API_URL` 指向它。

目前 adapter 將成功 JSON 視為已符合 DTO，不會在瀏覽器端完整驗證巢狀欄位；伺服器仍需驗證回應，後續 DTO runtime validation 是接入真實 API 前的待辦。
