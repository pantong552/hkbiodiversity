-- 1. 新增 plant_id 欄位，指向 plant_species 資料表 (假設植物的主鍵為 UUID，否則請根據實際調整型別)
ALTER TABLE public.user_favorites 
ADD COLUMN plant_id UUID REFERENCES public.plant_species(id) ON DELETE CASCADE;

-- 2. 移除原有的 Unique constraint (讓 plant_id 與 species_id 可以被混合使用)
-- 注意：這裡的 constrain name (user_favorites_user_id_species_id_key) 可能是自動產生的，
-- 如果執行失敗可以到 Supabase 表格設定中找到對應的 Unique 約束並移除。
ALTER TABLE public.user_favorites 
DROP CONSTRAINT IF EXISTS user_favorites_user_id_species_id_key;

-- 3. 允許 species_id 變成 NULL (因為當收藏植物時，species_id 會是 NULL)
ALTER TABLE public.user_favorites 
ALTER COLUMN species_id DROP NOT NULL;

-- 4. 確保使用者不能重複收藏同一個植物或動物
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_user_id_species_id 
ON public.user_favorites(user_id, species_id) WHERE species_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_favorites_user_id_plant_id 
ON public.user_favorites(user_id, plant_id) WHERE plant_id IS NOT NULL;

-- 5. 約定至少其一存在 (不能兩個都沒有，也不能兩個都有)
ALTER TABLE public.user_favorites 
ADD CONSTRAINT check_species_or_plant CHECK (
    (species_id IS NOT NULL AND plant_id IS NULL) OR 
    (species_id IS NULL AND plant_id IS NOT NULL)
);
