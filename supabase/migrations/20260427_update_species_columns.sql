-- 調整 Species 與 Plant Species 欄位
-- 1. 處理動物 (species) 表
ALTER TABLE species 
ADD COLUMN IF NOT EXISTS host_plants_chi text,
ADD COLUMN IF NOT EXISTS host_plants_eng text,
ADD COLUMN IF NOT EXISTS habitat_chi text,
ADD COLUMN IF NOT EXISTS habitat_eng text,
ADD COLUMN IF NOT EXISTS "HKBWS_cat" text;

-- 移除舊欄位
ALTER TABLE species 
DROP COLUMN IF EXISTS slug,
DROP COLUMN IF EXISTS image_url;

-- 2. 處理植物 (plant_species) 表
-- 移除舊欄位 (如果存在)
ALTER TABLE plant_species 
DROP COLUMN IF EXISTS image_url;

-- 注意：plant_species 已有 habitat 及 habitat_chi，故不需新增
