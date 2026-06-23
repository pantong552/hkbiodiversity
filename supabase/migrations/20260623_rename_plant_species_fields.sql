-- 重新命名植物 (plant_species) 中打錯的 _chi1 欄位為 _chi
ALTER TABLE plant_species RENAME COLUMN category_chi1 TO category_chi;
ALTER TABLE plant_species RENAME COLUMN family_chi1 TO family_chi;
ALTER TABLE plant_species RENAME COLUMN genus_chi1 TO genus_chi;
