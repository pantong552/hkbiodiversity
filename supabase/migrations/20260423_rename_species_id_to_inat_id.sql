-- 1. 重新命名 species 表中的 species_id 欄位為 inat_id
ALTER TABLE public.species RENAME COLUMN species_id TO inat_id;

-- 2. 重新命名 plant_species 表中的 species_id 欄位為 inat_id
ALTER TABLE public.plant_species RENAME COLUMN species_id TO inat_id;

-- 3. 重新命名 comments 表中的 species_id 欄位為 inat_id (假設此欄位儲存的是 iNat ID)
-- 注意：如果 comments.species_id 是指向 species(id) 的外鍵，請謹慎改名。
-- 根據代碼觀察 CommentSection.tsx，這似乎是用於過濾特定物種的 ID。
ALTER TABLE public.comments RENAME COLUMN species_id TO inat_id;

-- 4. 更新相關索引 (Optional, Supabase 通常會自動處理 RENAME，但明確執行更安全)
-- 如果你有自定義索引名稱，建議一併檢查。
