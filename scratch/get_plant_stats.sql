-- 建立植物統計 RPC，支援 Cross-filtering 及雙語支援 (Chinese & English)
CREATE OR REPLACE FUNCTION get_plant_stats(
  p_categories text[] DEFAULT '{}',
  p_families text[] DEFAULT '{}',
  p_genuses text[] DEFAULT '{}',
  p_is_cap96 boolean DEFAULT NULL,
  p_is_cap586 boolean DEFAULT NULL,
  p_is_rare boolean DEFAULT NULL,
  p_is_china_red_book boolean DEFAULT NULL,
  p_flowering_months int2[] DEFAULT '{}',
  p_fruiting_months int2[] DEFAULT '{}',
  p_search text DEFAULT ''
)
RETURNS json AS $$
DECLARE
  result json;
  query_base text := 'SELECT * FROM plant_species WHERE true';
BEGIN
  -- 動態建立過濾條件
  IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 0 THEN
    -- 這裡假設我們用中文名作為 filter 的 Key (與前端狀態一致)
    query_base := query_base || ' AND category_zh = ANY($1)';
  END IF;
  IF p_families IS NOT NULL AND array_length(p_families, 1) > 0 THEN
    query_base := query_base || ' AND family_zh = ANY($2)';
  END IF;
  IF p_genuses IS NOT NULL AND array_length(p_genuses, 1) > 0 THEN
    query_base := query_base || ' AND genus_zh = ANY($3)';
  END IF;
  IF p_is_cap96 IS TRUE THEN
    query_base := query_base || ' AND is_cap96 = ''Y''';
  END IF;
  IF p_is_cap586 IS TRUE THEN
    query_base := query_base || ' AND is_cap586 = ''Y''';
  END IF;
  IF p_is_rare IS TRUE THEN
    query_base := query_base || ' AND hk_rare_precious_note != ''No''';
  END IF;
  IF p_is_china_red_book IS TRUE THEN
    query_base := query_base || ' AND china_red_data_book_note != ''沒有列入''';
  END IF;
  IF p_flowering_months IS NOT NULL AND array_length(p_flowering_months, 1) > 0 THEN
    query_base := query_base || ' AND flowering_months && $8';
  END IF;
  IF p_fruiting_months IS NOT NULL AND array_length(p_fruiting_months, 1) > 0 THEN
    query_base := query_base || ' AND fruiting_months && $9';
  END IF;
  IF p_search != '' THEN
    query_base := query_base || ' AND fts @@ plainto_tsquery(''simple'', $10)';
  END IF;

  -- 執行統計並包裝成 JSON 結構 (包含雙語名)
  EXECUTE '
    WITH filtered_plants AS (' || query_base || '),
    cat_stats AS (
      SELECT category_zh as name, category_en as en, count(*) as count 
      FROM filtered_plants 
      GROUP BY category_zh, category_en
    ),
    fam_stats AS (
      SELECT family_zh as name, family_en as en, count(*) as count 
      FROM filtered_plants 
      GROUP BY family_zh, family_en
    ),
    gen_stats AS (
      SELECT genus_zh as name, genus_en as en, count(*) as count 
      FROM filtered_plants 
      GROUP BY genus_zh, genus_en
    )
    SELECT json_build_object(
      ''categories'', COALESCE((SELECT json_agg(cat_stats) FROM cat_stats), ''[]''::json),
      ''families'', COALESCE((SELECT json_agg(fam_stats) FROM fam_stats), ''[]''::json),
      ''genuses'', COALESCE((SELECT json_agg(gen_stats) FROM gen_stats), ''[]''::json)
    )'
    INTO result
    USING p_categories, p_families, p_genuses, NULL, NULL, NULL, NULL, p_flowering_months, p_fruiting_months, p_search;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 額外增加英文欄位索引
CREATE INDEX IF NOT EXISTS idx_plants_category_en ON plant_species(category_en);
CREATE INDEX IF NOT EXISTS idx_plants_family_en ON plant_species(family_en);
CREATE INDEX IF NOT EXISTS idx_plants_genus_en ON plant_species(genus_en);
