-- 增加分類群索引
CREATE INDEX IF NOT EXISTS idx_species_informal_group_eng ON species(informal_group_eng);
CREATE INDEX IF NOT EXISTS idx_species_informal_group_chi ON species(informal_group_chi);

-- 更新統計 RPC 函數以支援分類群
CREATE OR REPLACE FUNCTION get_species_stats(
  p_phylum_eng text[] DEFAULT '{}',
  p_class_eng text[] DEFAULT '{}',
  p_order_eng text[] DEFAULT '{}',
  p_family_eng text[] DEFAULT '{}',
  p_genus_eng text[] DEFAULT '{}',
  p_informal_group_eng text[] DEFAULT '{}',
  p_iucn text[] DEFAULT '{}',
  p_search text DEFAULT ''
)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  WITH filtered_species AS (
    SELECT *
    FROM species
    WHERE 
      (cardinality(p_phylum_eng) = 0 OR phylum_eng = ANY(p_phylum_eng)) AND
      (cardinality(p_class_eng) = 0 OR class_eng = ANY(p_class_eng)) AND
      (cardinality(p_order_eng) = 0 OR order_eng = ANY(p_order_eng)) AND
      (cardinality(p_family_eng) = 0 OR family_eng = ANY(p_family_eng)) AND
      (cardinality(p_genus_eng) = 0 OR genus_eng = ANY(p_genus_eng)) AND
      (cardinality(p_informal_group_eng) = 0 OR informal_group_eng = ANY(p_informal_group_eng)) AND
      (cardinality(p_iucn) = 0 OR iucn = ANY(p_iucn)) AND
      (p_search = '' OR 
        scientific_name ILIKE '%' || p_search || '%' OR 
        common_name_chi ILIKE '%' || p_search || '%' OR 
        common_name_eng ILIKE '%' || p_search || '%'
      )
  )
  SELECT json_build_object(
    'phylum_eng', (SELECT json_agg(t) FROM (SELECT phylum_eng as name, count(*) FROM filtered_species GROUP BY phylum_eng) t),
    'class_eng', (SELECT json_agg(t) FROM (SELECT class_eng as name, count(*) FROM filtered_species GROUP BY class_eng) t),
    'order_eng', (SELECT json_agg(t) FROM (SELECT order_eng as name, count(*) FROM filtered_species GROUP BY order_eng) t),
    'family_eng', (SELECT json_agg(t) FROM (SELECT family_eng as name, count(*) FROM filtered_species GROUP BY family_eng) t),
    'genus_eng', (SELECT json_agg(t) FROM (SELECT genus_eng as name, count(*) FROM filtered_species GROUP BY genus_eng) t),
    'informal_group_eng', (SELECT json_agg(t) FROM (SELECT informal_group_eng as name, count(*) FROM filtered_species GROUP BY informal_group_eng) t),
    'iucn', (SELECT json_object_agg(iucn, count) FROM (SELECT iucn, count(*) as count FROM filtered_species GROUP BY iucn) t)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
