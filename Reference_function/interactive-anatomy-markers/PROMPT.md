# 移植 Prompt：Interactive Anatomy Markers

請把本資料夾內的「Interactive Anatomy Markers」功能移植到目前 webapp。先讀本資料夾 `README.md` 和 `reference/`，再檢查目標專案的框架、資料模型、登入/管理員授權和設計系統；不要假設目標 app 與來源 app 同樣使用 Next.js、Tailwind 或 HKBR 的物種 schema。請直接完成整合、資料庫 migration、管理控制台與驗證，不要只提供計畫。

## 功能需求

1. 在物種/實體詳情頁展示一張可配置的特徵插圖，於圖上以百分比座標顯示多個互動 marker。
2. Marker 支援 hover 與 click；當前選中的 marker 在圖片下方顯示當前語言的 HTML/富文字特徵說明。點擊空白圖片區取消選取。提供繁體中文與英文切換/頁面語言對應。
3. 在受管理員保護的控制台中，可選取物種、點擊插圖新增 marker、拖曳調整位置、編輯唯一 key、X/Y 百分比、中英文描述，以及刪除 marker。畫布座標必須以實際顯示的插圖本身為準，新增與拖曳不能相對外層留白計算，避免圖片有 letterbox 時座標偏移。X/Y 要限制在 0–100，key 必須唯一。
4. 前台及 admin 共用同一個 marker 資料契約和底圖來源；圖片 URL 由目標 app 的資料/媒體設定注入，不要沿用來源 app 對少數蝙蝠物種的 fallback 圖片。
5. 以目標 app 慣例實作載入中、空狀態、錯誤提示、儲存中和儲存成功/失敗狀態；手機與桌面均可操作，拖曳需支援適當的 pointer/touch 操作。

## 資料契約與資料庫

來源 app 的核心資料契約如下，依目標 schema 改名/轉換即可：

- 一個 hotspot 屬於一個物種：`species_id`。
- `hotspot_key` 是同一物種內唯一識別鍵。
- `x_percent`、`y_percent` 是 0–100 的圖片相對座標。
- `placement` 是來源欄位（預設 `top`），來源前台目前沒有使用它；若目標 UI 不需要可省略，否則保留相容欄位。
- 每個 hotspot 可有多個翻譯：`lang` 和 HTML `content`；來源資料使用 `zh`、`en`。
- FK 刪除行為需在刪除物種或 hotspot 時一併刪除所屬資料。

先檢視並按需套用 `supabase/001_anatomy_hotspots_schema.sql`。它刻意只建立公開 SELECT，不授予 anon 或一般 authenticated 使用者寫入。為 admin 寫入另依目標 app 現有的管理員 claim/profile/role policy 加上最小權限 GRANT 和 RLS policy；不可建立 `TO public FOR ALL` 或任何匿名寫入政策。不要執行 `reference/scratch/setup_anatomy_hotspots.sql`：該檔包含來源專案的物種 seed 資料、清除同物種舊 hotspot 的 DELETE，以及對 public 開放的 FOR ALL policy。

若目標 app 使用 Supabase，沿用其現有 client 和登入 session。儲存整組 hotspot 與翻譯時必須具原子性（例如受 admin RLS 保護的 Postgres RPC transaction），避免先刪資料再插入時中途失敗造成資料遺失。若採 upsert/差異更新，需同樣處理刪除和翻譯同步。

## 安全性與相容性

- 若翻譯內容以 HTML 渲染，必須以可信任的 HTML sanitizer 清理後再渲染；不要直接照搬來源元件未清理的 `dangerouslySetInnerHTML`。若不需要格式，改存純文字並正常 escape。
- 請依目標 app 的圖片安全、遠端圖片 allowlist、CSP 和 responsive image 慣例處理插圖。
- 讀取時將資料庫欄位明確轉成前端型別：`key, x, y, placement, zh, en`；缺少某語言翻譯時使用空字串或目標 app 的既定 fallback。
- 若目標 app 不使用 Supabase，保留資料契約並改接既有 API/ORM；SQL 檔只作 Supabase schema 參照。

## 來源參考

- 前台互動與視覺行為：`reference/src/components/InteractiveAnatomy.tsx`
- 控制台完整來源：`reference/src/app/admin/species/page.tsx`。此檔非常大；搜尋 `hotspotsForm`、`handleContainerClick`、`handleContainerMouseMove`、`載入互動熱點`、`更新/儲存互動熱點`、`互動式特徵插圖標記` 可定位功能段落。
- 查詢/mapping：`reference/src/lib/db.ts`，搜尋 `species_anatomy_hotspots` 和 `整理互動熱點`。
- 型別：`reference/src/types/species.ts` 的 `AnatomyHotspotItem`。
- 前台頁面入口：`reference/src/app/[slug]/page.tsx` 與 `reference/src/app/en/[species_code]/page.tsx`。
- 來源底圖 mapping、圖片優化和 schema/seed 參照見 README。

## 完成條件

- migration 可在乾淨的目標 Supabase schema 執行，並可重複執行（若採用的 DDL/政策允許）。
- 公開使用者可以讀取資料但不能寫入；只有目標 app 已授權的管理員可以新增/更新/刪除。
- 物種頁能正確顯示各語言 marker；缺資料時不破版。
- admin 可以完整建立、調整、翻譯、刪除並保存 marker；儲存錯誤不會造成既有資料被清空。
- 座標在不同寬高比圖片、responsive 尺寸和行動裝置上仍精準對齊。
- 加入或更新針對座標邊界、雙語 mapping、未授權寫入、原子儲存及主要互動的測試；執行目標專案可用的相關測試、lint/typecheck/build，回報結果和任何需要人工設定的 RLS/環境變數。
