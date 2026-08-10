-- 1. 在 plant_species table 中新增 alias 相關欄位
ALTER TABLE plant_species
ADD COLUMN IF NOT EXISTS alias_scientific_name text,
ADD COLUMN IF NOT EXISTS alias_common_name_chi text,
ADD COLUMN IF NOT EXISTS alias_common_name_eng text;

-- 2. 更新 Flora 表格中繼資料函數 get_flora_table_metadata
CREATE OR REPLACE FUNCTION get_flora_table_metadata(
    p_search text DEFAULT ''::text,
    p_categories text[] DEFAULT '{}'::text[],
    p_family text[] DEFAULT '{}'::text[],
    p_genus text[] DEFAULT '{}'::text[],
    p_scientific_name text[] DEFAULT '{}'::text[],
    p_common_name text[] DEFAULT '{}'::text[],
    p_native_status text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    WITH filtered_data AS (
        SELECT * FROM plant_species
        WHERE (p_search = '' OR 
               common_name_chi ILIKE '%'||p_search||'%' OR 
               common_name_eng ILIKE '%'||p_search||'%' OR 
               scientific_name ILIKE '%'||p_search||'%' OR
               alias_common_name_chi ILIKE '%'||p_search||'%' OR 
               alias_common_name_eng ILIKE '%'||p_search||'%' OR 
               alias_scientific_name ILIKE '%'||p_search||'%')
          AND (cardinality(p_categories) = 0 OR category_eng = ANY(p_categories))
          AND (cardinality(p_family) = 0 OR family_eng = ANY(p_family))
          AND (cardinality(p_genus) = 0 OR genus_eng = ANY(p_genus))
          AND (cardinality(p_scientific_name) = 0 OR scientific_name = ANY(p_scientific_name))
          AND (cardinality(p_common_name) = 0 OR common_name_chi = ANY(p_common_name))
          AND (cardinality(p_native_status) = 0 OR origin = ANY(p_native_status))
    )
    SELECT jsonb_build_object(
        'family', (SELECT jsonb_agg(t) FROM (SELECT family_eng as name, family_eng as en, count(*)::int as count FROM filtered_data WHERE family_eng IS NOT NULL GROUP BY family_eng ORDER BY count DESC) t),
        'genus', (SELECT jsonb_agg(t) FROM (SELECT genus_eng as name, genus_eng as en, count(*)::int as count FROM filtered_data WHERE genus_eng IS NOT NULL GROUP BY genus_eng ORDER BY count DESC) t),
        'scientific_name', (SELECT jsonb_agg(t) FROM (SELECT scientific_name as name, scientific_name as display, count(*)::int as count FROM filtered_data GROUP BY scientific_name ORDER BY count DESC) t),
        'common_name', (SELECT jsonb_agg(t) FROM (SELECT common_name_chi as name, common_name_chi as display, common_name_eng as en, count(*)::int as count FROM filtered_data WHERE common_name_chi IS NOT NULL GROUP BY common_name_chi, common_name_eng ORDER BY count DESC) t),
        'iucn', (SELECT jsonb_agg(t) FROM (SELECT hk_rare_precious_note as name, hk_rare_precious_note as display, count(*)::int as count FROM filtered_data WHERE hk_rare_precious_note IS NOT NULL GROUP BY hk_rare_precious_note ORDER BY count DESC) t),
        'native_status', (SELECT jsonb_agg(t) FROM (SELECT origin as name, origin as display, count(*)::int as count FROM filtered_data WHERE origin IS NOT NULL GROUP BY origin ORDER BY count DESC) t)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- 3. 更新 Flora 元數據/統計函數 get_plant_stats
CREATE OR REPLACE FUNCTION get_plant_stats(
    p_categories text[] DEFAULT '{}'::text[],
    p_families text[] DEFAULT '{}'::text[],
    p_genuses text[] DEFAULT '{}'::text[],
    p_origins text[] DEFAULT '{}'::text[],
    p_is_cap96 boolean DEFAULT false,
    p_is_cap586 boolean DEFAULT false,
    p_is_rare boolean DEFAULT false,
    p_is_china_red_book boolean DEFAULT false,
    p_flowering_months integer[] DEFAULT '{}'::integer[],
    p_fruiting_months integer[] DEFAULT '{}'::integer[],
    p_search text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_categories jsonb;
    v_families jsonb;
    v_genuses jsonb;
    v_query text;
BEGIN
    -- 1. 構建基礎查詢路徑
    v_query := 'SELECT id FROM plant_species WHERE 1=1';

    -- 2. 篩選條件
    IF array_length(p_categories, 1) > 0 THEN v_query := v_query || ' AND category_eng = ANY($1)'; END IF;
    IF array_length(p_families, 1) > 0 THEN v_query := v_query || ' AND family_eng = ANY($2)'; END IF;
    IF array_length(p_genuses, 1) > 0 THEN v_query := v_query || ' AND genus_eng = ANY($3)'; END IF;
    IF array_length(p_origins, 1) > 0 THEN v_query := v_query || ' AND origin = ANY($4)'; END IF;
    
    IF p_is_cap96 THEN v_query := v_query || ' AND is_cap96 = ''Y'''; END IF;
    IF p_is_cap586 THEN v_query := v_query || ' AND is_cap586 = ''Y'''; END IF;
    IF p_is_rare THEN v_query := v_query || ' AND (hk_rare_precious_note IS NOT NULL AND hk_rare_precious_note != ''No'')'; END IF;
    IF p_is_china_red_book THEN v_query := v_query || ' AND (china_red_data_book_note IS NOT NULL AND china_red_data_book_note != ''沒有列入'')'; END IF;
    
    -- 花期/果期交集比對
    IF array_length(p_flowering_months, 1) > 0 THEN 
        v_query := v_query || ' AND flowering_months::text[] && ARRAY[' || 
          (SELECT string_agg('''' || m || '''', ',') FROM unnest(p_flowering_months) m) || ']::text[]'; 
    END IF;

    IF array_length(p_fruiting_months, 1) > 0 THEN 
        v_query := v_query || ' AND fruiting_months::text[] && ARRAY[' || 
          (SELECT string_agg('''' || m || '''', ',') FROM unnest(p_fruiting_months) m) || ']::text[]'; 
    END IF;
    
    -- 搜尋條件（已包含 3 個別名欄位）
    IF p_search != '' AND p_search IS NOT NULL THEN 
        v_query := v_query || ' AND (
            scientific_name ILIKE ''%'' || $5 || ''%'' OR 
            common_name_chi ILIKE ''%'' || $5 || ''%'' OR 
            common_name_eng ILIKE ''%'' || $5 || ''%'' OR
            alias_scientific_name ILIKE ''%'' || $5 || ''%'' OR
            alias_common_name_chi ILIKE ''%'' || $5 || ''%'' OR
            alias_common_name_eng ILIKE ''%'' || $5 || ''%''
        )';
    END IF;

    -- 3. 獲取統計
    EXECUTE 'WITH filtered AS (' || v_query || ') 
             SELECT jsonb_agg(d) FROM (
                SELECT category_eng as en, count(*) as count 
                FROM plant_species 
                WHERE id IN (SELECT id FROM filtered)
                GROUP BY category_eng
             ) d' 
    INTO v_categories USING p_categories, p_families, p_genuses, p_origins, p_search;

    EXECUTE 'WITH filtered AS (' || v_query || ') 
             SELECT jsonb_agg(d) FROM (
                SELECT family_eng as en, count(*) as count 
                FROM plant_species 
                WHERE id IN (SELECT id FROM filtered)
                GROUP BY family_eng
             ) d' 
    INTO v_families USING p_categories, p_families, p_genuses, p_origins, p_search;

    EXECUTE 'WITH filtered AS (' || v_query || ') 
             SELECT jsonb_agg(d) FROM (
                SELECT genus_eng as en, count(*) as count 
                FROM plant_species 
                WHERE id IN (SELECT id FROM filtered)
                GROUP BY genus_eng
             ) d' 
    INTO v_genuses USING p_categories, p_families, p_genuses, p_origins, p_search;

    -- 4. 傳回結果
    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'families', COALESCE(v_families, '[]'::jsonb),
        'genuses', COALESCE(v_genuses, '[]'::jsonb)
    );
END;
$$;

-- 4. 更新 Fauna 側邊欄統計函數 get_species_stats
CREATE OR REPLACE FUNCTION get_species_stats(
    p_phylum_eng text[] DEFAULT '{}'::text[],
    p_class_eng text[] DEFAULT '{}'::text[],
    p_order_eng text[] DEFAULT '{}'::text[],
    p_family_eng text[] DEFAULT '{}'::text[],
    p_genus_eng text[] DEFAULT '{}'::text[],
    p_informal_group_eng text[] DEFAULT '{}'::text[],
    p_iucn text[] DEFAULT '{}'::text[],
    p_is_cap170 boolean DEFAULT NULL,
    p_is_cap586 boolean DEFAULT NULL,
    p_search text DEFAULT ''::text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb;
BEGIN
    WITH filtered_data AS (
        SELECT * FROM plant_species
        WHERE (p_search = '' OR 
               common_name_chi ILIKE '%'||p_search||'%' OR 
               common_name_eng ILIKE '%'||p_search||'%' OR 
               scientific_name ILIKE '%'||p_search||'%' OR
               alias_common_name_chi ILIKE '%'||p_search||'%' OR 
               alias_common_name_eng ILIKE '%'||p_search||'%' OR 
               alias_scientific_name ILIKE '%'||p_search||'%')
          AND (cardinality(p_categories) = 0 OR category_eng = ANY(p_categories))
          AND (cardinality(p_family) = 0 OR family_eng = ANY(p_family))
          AND (cardinality(p_genus) = 0 OR genus_eng = ANY(p_genus))
          AND (cardinality(p_scientific_name) = 0 OR scientific_name = ANY(p_scientific_name))
          AND (cardinality(p_common_name) = 0 OR common_name_chi = ANY(p_common_name))
          AND (cardinality(p_native_status) = 0 OR origin = ANY(p_native_status))
    )
    SELECT jsonb_build_object(
        'family', (SELECT jsonb_agg(t) FROM (SELECT family_eng as name, family_eng as en, count(*)::int as count FROM filtered_data WHERE family_eng IS NOT NULL GROUP BY family_eng ORDER BY count DESC) t),
        'genus', (SELECT jsonb_agg(t) FROM (SELECT genus_eng as name, genus_eng as en, count(*)::int as count FROM filtered_data WHERE genus_eng IS NOT NULL GROUP BY genus_eng ORDER BY count DESC) t),
        'scientific_name', (SELECT jsonb_agg(t) FROM (SELECT scientific_name as name, scientific_name as display, count(*)::int as count FROM filtered_data GROUP BY scientific_name ORDER BY count DESC) t),
        'common_name', (SELECT jsonb_agg(t) FROM (SELECT common_name_chi as name, common_name_chi as display, common_name_eng as en, count(*)::int as count FROM filtered_data WHERE common_name_chi IS NOT NULL GROUP BY common_name_chi, common_name_eng ORDER BY count DESC) t),
        'iucn', (SELECT jsonb_agg(t) FROM (SELECT hk_rare_precious_note as name, hk_rare_precious_note as display, count(*)::int as count FROM filtered_data WHERE hk_rare_precious_note IS NOT NULL GROUP BY hk_rare_precious_note ORDER BY count DESC) t),
        'native_status', (SELECT jsonb_agg(t) FROM (SELECT origin as name, origin as display, count(*)::int as count FROM filtered_data WHERE origin IS NOT NULL GROUP BY origin ORDER BY count DESC) t)
    ) INTO result;
    
    RETURN result;
END;
$$;
