# Interactive Anatomy Markers Export

此資料夾是供另一個 webapp / AI coding agent 使用的移植包，不是可直接執行的獨立 app。

## 內容

- `PROMPT.md`: 可直接交給另一個 AI 的繁體中文移植 prompt。
- `supabase/001_anatomy_hotspots_schema.sql`: 新 app 使用的 schema-only 基礎 migration。只允許公開讀取，沒有開放匿名/一般登入者寫入。
- `reference/`: 從目前 HKBR app 原樣複製的相關前台、admin、資料存取、型別、圖片設定、Supabase client 和原始 SQL，供目標 app 參照。

前端來源以 React 19、Next.js 16、Tailwind CSS 4 和 `lucide-react` 實作；若目標 app 不同，移植互動與資料契約，不要原封不動搬 Next.js 專用語法或 Tailwind class。Supabase 資料層使用 `@supabase/supabase-js`。原始 admin species 頁約 3,177 行，因為此工具與其他物種編輯功能共用同一頁，故保留完整原檔以便追蹤讀取/儲存上下文，而不是將無關區塊偽裝成獨立可執行元件。

## 重要安全/資料注意事項

`reference/scratch/setup_anatomy_hotspots.sql` 是原專案完整歷史安裝與資料匯入腳本，包含既有物種的 DELETE/INSERT seed 區塊，並建立 `TO public FOR ALL` 寫入政策。不要在目標資料庫直接執行。新 app 請先執行 schema-only migration，再按目標 app 的管理員授權模型另行設定最小權限寫入政策。

原始控制台以刪除後重插方式儲存熱點；移植時應使用 transaction / RPC，或其他具原子性的儲存策略，避免翻譯寫入失敗時留下空資料。前台原始元件以 `dangerouslySetInnerHTML` 顯示翻譯 HTML；目標 app 必須沿用可信任內容約束並加入 HTML sanitization，或改存/顯示純文字。

## 原始來源索引

- `reference/src/components/InteractiveAnatomy.tsx`: 前台 marker、hover/click、雙語描述及圖片呈現。
- `reference/src/app/admin/species/page.tsx`: admin marker 編輯器，含新增、拖曳、刪除、雙語富文字編輯、載入與儲存；這是完整物種管理頁，內有大量與本功能無關的控制台程式。
- `reference/src/lib/db.ts`: Supabase 關聯查詢和 hotspots 到前端型別的 mapping。
- `reference/src/types/species.ts`: `AnatomyHotspotItem` 型別及 Species hotspots 欄位。
- `reference/src/app/[slug]/page.tsx`、`reference/src/app/en/[species_code]/page.tsx`: 中英文物種頁的前台掛載點。
- `reference/src/data/illustrationUrls.json`、`reference/src/lib/cloudinary.ts`: 原 app 的插圖 URL 與圖片最佳化依賴。
- `reference/public/images/`: 原元件在缺少插圖 mapping 時使用的兩張本地 fallback 圖片；移植時應換成目標 app 的插圖。
- `reference/src/lib/supabaseClient.ts`: 原 app Supabase client 設定參照。
- `reference/scratch/setup_anatomy_hotspots.sql`: 原始完整 SQL，僅供查閱既有 seed 資料和政策，不要直接執行。

## 移植前需對應

目標資料庫的物種主表與唯一識別欄位、admin authorization/RLS、圖片 URL/儲存方式、前端 CSS/design system、以及富文字格式都可能不同。請依 `PROMPT.md` 對應，不要假設目標 app 使用 Next.js、Tailwind 或相同的 `species` schema。
