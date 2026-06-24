-- 建立參考文獻表 (References Table)
CREATE TABLE IF NOT EXISTS public.references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    zh TEXT NOT NULL,
    en TEXT NOT NULL,
    url TEXT, -- 新增的選擇性超連結欄位
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 確保即使 references 表先前已建立，也能成功加上 url 欄位
ALTER TABLE public.references ADD COLUMN IF NOT EXISTS url TEXT;

-- 啟用 Row Level Security (RLS)
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

-- 刪除可能存在的舊政策
DROP POLICY IF EXISTS "Anyone can view references" ON public.references;
DROP POLICY IF EXISTS "Admins can insert references" ON public.references;
DROP POLICY IF EXISTS "Admins can update references" ON public.references;
DROP POLICY IF EXISTS "Admins can delete references" ON public.references;

-- 政策：所有人均可查看文獻
CREATE POLICY "Anyone can view references" 
ON public.references 
FOR SELECT 
USING (true);

-- 政策：只有 Admin 可以新增、修改及刪除文獻
CREATE POLICY "Admins can insert references" 
ON public.references 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update references" 
ON public.references 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete references" 
ON public.references 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 物種與植物資料表欄位調整
-- 1. 移除 species 中原本皆為空白的舊 references_chi 與 references_eng 欄位
ALTER TABLE public.species DROP COLUMN IF EXISTS references_chi;
ALTER TABLE public.species DROP COLUMN IF EXISTS references_eng;

-- 2. 為 species 新增 reference_codes 欄位
ALTER TABLE public.species ADD COLUMN IF NOT EXISTS reference_codes TEXT;

-- 3. 為 plant_species 新增 reference_codes 欄位
ALTER TABLE public.plant_species ADD COLUMN IF NOT EXISTS reference_codes TEXT;

-- 建立索引以優化 references 表搜尋與關聯
CREATE INDEX IF NOT EXISTS idx_references_code ON public.references(code);

-- 插入一些 APA 第 7 版格式的範例文獻 (Seed Data，將 URL 欄位獨立儲存)
INSERT INTO public.references (code, zh, en, url)
VALUES 
('ref_1', '漁農自然護理署. (2021). *香港物種資料庫*.', 'Agriculture, Fisheries and Conservation Department. (2021). *Hong Kong Species Database*.', 'https://www.afcd.gov.hk/'),
('ref_2', '香港觀鳥會. (2023). *香港鳥類名錄*.', 'Hong Kong Bird Watching Society. (2023). *List of Hong Kong Birds*.', 'https://www.hkbws.org.hk/'),
('ref_3', '世界自然保護聯盟. (2024). *IUCN 瀕危物種紅色名錄*.', 'IUCN. (2024). *The IUCN Red List of Threatened Species*.', 'https://www.iucnredlist.org/'),
('ref_4', '葉國樑. (2010). *香港蝴蝶圖誌*. 郊野公園之友會.', 'Yip, K. L. (2010). *A Photographic Guide to Butterflies of Hong Kong*. Friends of the Country Parks.', NULL)
ON CONFLICT (code) DO NOTHING;
