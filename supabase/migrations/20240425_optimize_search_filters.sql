-- 針對物種搜尋與表格過濾優化的索引建議

-- Fauna (species) 索引
CREATE INDEX IF NOT EXISTS idx_species_order_eng ON species(order_eng);
CREATE INDEX IF NOT EXISTS idx_species_family_eng ON species(family_eng);
CREATE INDEX IF NOT EXISTS idx_species_iucn ON species(iucn);
CREATE INDEX IF NOT EXISTS idx_species_native_status ON species(native_status);

-- Flora (plant_species) 索引
CREATE INDEX IF NOT EXISTS idx_plants_order_zh ON plant_species(order_zh);
CREATE INDEX IF NOT EXISTS idx_plants_family_zh ON plant_species(family_zh);
CREATE INDEX IF NOT EXISTS idx_plants_origin ON plant_species(origin);
CREATE INDEX IF NOT EXISTS idx_plants_china_red_book ON plant_species(china_red_data_book_note);

-- 為了加快 Scientific Name 和 Common Name 的搜尋，建議使用 GIN 索引 (如果資料量極大且啟用 pg_trgm)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_species_sci_name_trgm ON species USING gin (scientific_name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_plants_sci_name_trgm ON plant_species USING gin (scientific_name gin_trgm_ops);
