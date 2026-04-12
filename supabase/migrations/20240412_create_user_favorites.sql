-- 擴充 profiles 資料表以支援最後上線時間
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 建立使用者收藏資料表 (User Favorites)
CREATE TABLE IF NOT EXISTS public.user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    species_id INTEGER NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- 確保同一個使用者不會收藏同一個物種兩次
    UNIQUE(user_id, species_id)
);

-- 啟用 Row Level Security (RLS)
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- 先刪除可能存在的舊政策以避免重複執行錯誤
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.user_favorites;
DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.user_favorites;

-- 重新建立政策
-- 政策：使用者可以查看自己的收藏
CREATE POLICY "Users can view their own favorites" 
ON public.user_favorites 
FOR SELECT 
USING (auth.uid() = user_id);

-- 政策：使用者可以新增自己的收藏
CREATE POLICY "Users can insert their own favorites" 
ON public.user_favorites 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 政策：使用者可以刪除自己的收藏
CREATE POLICY "Users can delete their own favorites" 
ON public.user_favorites 
FOR DELETE 
USING (auth.uid() = user_id);

-- 建議索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_species_id ON public.user_favorites(species_id);
