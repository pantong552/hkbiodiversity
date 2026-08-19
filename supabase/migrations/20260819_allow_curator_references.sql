-- 允許 Admin 和 Curator 新增與更新 references (參考文獻)

-- 1. 刪除原本僅限 Admin 的 Insert / Update 政策
DROP POLICY IF EXISTS "Admins can insert references" ON public.references;
DROP POLICY IF EXISTS "Admins can update references" ON public.references;
DROP POLICY IF EXISTS "Admins and Curators can insert references" ON public.references;
DROP POLICY IF EXISTS "Admins and Curators can update references" ON public.references;

-- 2. 建立新政策：Admin 與 Curator 均可新增參考文獻
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

-- 3. 建立新政策：Admin 與 Curator 均可修改參考文獻
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
