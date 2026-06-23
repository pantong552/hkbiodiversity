-- 新增 introduction, microhabitat 與 similar_species 欄位
ALTER TABLE species 
ADD COLUMN IF NOT EXISTS introduction_chi text,
ADD COLUMN IF NOT EXISTS introduction_eng text,
ADD COLUMN IF NOT EXISTS microhabitat_chi text,
ADD COLUMN IF NOT EXISTS microhabitat_eng text,
ADD COLUMN IF NOT EXISTS similar_species text;
