-- 1. 確保 plant_species 的 oid 欄位有唯一約束，這是執行 ON CONFLICT 的前提
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'plant_species_oid_key'
    ) THEN
        ALTER TABLE plant_species ADD CONSTRAINT plant_species_oid_key UNIQUE (oid);
    END IF;
END $$;

-- 2. 使用 UPSERT (INSERT ... ON CONFLICT) 從 temp_plant_species 更新到 plant_species
INSERT INTO plant_species (
    inat_id,
    oid,
    category_zh,
    category_en,
    family_zh,
    family_en,
    genus_zh,
    genus_en,
    scientific_name,
    author,
    common_name_zh,
    common_name_en,
    origin,
    is_cap96,
    is_cap586,
    hk_rare_precious_note,
    china_red_data_book_note,
    flowering_period,
    fruiting_period,
    description,
    locality,
    distribution,
    habitat,
    usage,
    remark,
    description_chi,
    locality_chi,
    distribution_chi,
    habitat_chi,
    usage_chi,
    remark_chi
)
SELECT 
    inat_id,
    oid,
    category_zh,
    category_en,
    family_zh,
    family_en,
    genus_zh,
    genus_en,
    scientific_name,
    author,
    common_name_zh,
    common_name_en,
    origin,
    is_cap96,
    is_cap586,
    hk_rare_precious_note,
    china_red_data_book_note,
    flowering_period,
    fruiting_period,
    description,
    locality,
    distribution,
    habitat,
    usage,
    remark,
    description_chi,
    locality_chi,
    distribution_chi,
    habitat_chi,
    usage_chi,
    remark_chi
FROM temp_plant_species
ON CONFLICT (oid) 
DO UPDATE SET
    inat_id = EXCLUDED.inat_id,
    category_zh = EXCLUDED.category_zh,
    category_en = EXCLUDED.category_en,
    family_zh = EXCLUDED.family_zh,
    family_en = EXCLUDED.family_en,
    genus_zh = EXCLUDED.genus_zh,
    genus_en = EXCLUDED.genus_en,
    scientific_name = EXCLUDED.scientific_name,
    author = EXCLUDED.author,
    common_name_zh = EXCLUDED.common_name_zh,
    common_name_en = EXCLUDED.common_name_en,
    origin = EXCLUDED.origin,
    is_cap96 = EXCLUDED.is_cap96,
    is_cap586 = EXCLUDED.is_cap586,
    hk_rare_precious_note = EXCLUDED.hk_rare_precious_note,
    china_red_data_book_note = EXCLUDED.china_red_data_book_note,
    flowering_period = EXCLUDED.flowering_period,
    fruiting_period = EXCLUDED.fruiting_period,
    description = EXCLUDED.description,
    locality = EXCLUDED.locality,
    distribution = EXCLUDED.distribution,
    habitat = EXCLUDED.habitat,
    usage = EXCLUDED.usage,
    remark = EXCLUDED.remark,
    description_chi = EXCLUDED.description_chi,
    locality_chi = EXCLUDED.locality_chi,
    distribution_chi = EXCLUDED.distribution_chi,
    habitat_chi = EXCLUDED.habitat_chi,
    usage_chi = EXCLUDED.usage_chi,
    remark_chi = EXCLUDED.remark_chi;

-- 3. (選用) 更新完成後，檢查更新數量
-- SELECT count(*) FROM plant_species;
