-- 1. 為 references 表加入 created_by 與 updated_by 欄位 (關聯至 profiles 表，方便 join 取得 username 等資訊)
ALTER TABLE public.references ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.references ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_references_created_by ON public.references(created_by);
CREATE INDEX IF NOT EXISTS idx_references_updated_by ON public.references(updated_by);

-- 3. 更新 RLS 政策，允許 Admin 與 Curator 進行新增與修改
DROP POLICY IF EXISTS "Admins can insert references" ON public.references;
DROP POLICY IF EXISTS "Admins can update references" ON public.references;
DROP POLICY IF EXISTS "Admins and Curators can insert references" ON public.references;
DROP POLICY IF EXISTS "Admins and Curators can update references" ON public.references;

CREATE POLICY "Admins and Curators can insert references" 
ON public.references 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'curator')
  )
);

CREATE POLICY "Admins and Curators can update references" 
ON public.references 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'curator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'curator')
  )
);
