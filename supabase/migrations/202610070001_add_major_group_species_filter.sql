CREATE INDEX IF NOT EXISTS idx_species_taxa_group ON public.species(taxa_group);

CREATE OR REPLACE FUNCTION public.get_species_filter_stats(
    p_phylum_eng text[] DEFAULT '{}'::text[],
    p_class_eng text[] DEFAULT '{}'::text[],
    p_order_eng text[] DEFAULT '{}'::text[],
    p_family_eng text[] DEFAULT '{}'::text[],
    p_genus_eng text[] DEFAULT '{}'::text[],
    p_informal_group_eng text[] DEFAULT '{}'::text[],
    p_iucn text[] DEFAULT '{}'::text[],
    p_is_cap170 boolean DEFAULT NULL,
    p_is_cap586 boolean DEFAULT NULL,
    p_search text DEFAULT ''::text,
    p_taxa_group text[] DEFAULT '{}'::text[]
)
RETURNS json
LANGUAGE sql
STABLE
AS $$
    WITH filtered_species AS (
        SELECT *
        FROM public.species
        WHERE
            (cardinality(p_phylum_eng) = 0 OR phylum_eng = ANY(p_phylum_eng)) AND
            (cardinality(p_class_eng) = 0 OR class_eng = ANY(p_class_eng)) AND
            (cardinality(p_order_eng) = 0 OR order_eng = ANY(p_order_eng)) AND
            (cardinality(p_family_eng) = 0 OR family_eng = ANY(p_family_eng)) AND
            (cardinality(p_genus_eng) = 0 OR genus_eng = ANY(p_genus_eng)) AND
            (cardinality(p_informal_group_eng) = 0 OR informal_group_eng = ANY(p_informal_group_eng)) AND
            (cardinality(p_taxa_group) = 0 OR taxa_group = ANY(p_taxa_group)) AND
            (cardinality(p_iucn) = 0 OR iucn = ANY(p_iucn)) AND
            (p_is_cap170 IS DISTINCT FROM TRUE OR cap170 = 'Y') AND
            (p_is_cap586 IS DISTINCT FROM TRUE OR cap586 = 'Y') AND
            (
                p_search = '' OR
                scientific_name ILIKE '%' || p_search || '%' OR
                common_name_chi ILIKE '%' || p_search || '%' OR
                common_name_eng ILIKE '%' || p_search || '%' OR
                alias_scientific_name ILIKE '%' || p_search || '%' OR
                alias_common_name_chi ILIKE '%' || p_search || '%' OR
                alias_common_name_eng ILIKE '%' || p_search || '%'
            )
    )
    SELECT json_build_object(
        'phylum_eng', (SELECT json_agg(t) FROM (SELECT phylum_eng AS name, count(*)::int AS count FROM filtered_species WHERE phylum_eng IS NOT NULL GROUP BY phylum_eng ORDER BY count(*) DESC) t),
        'class_eng', (SELECT json_agg(t) FROM (SELECT class_eng AS name, count(*)::int AS count FROM filtered_species WHERE class_eng IS NOT NULL GROUP BY class_eng ORDER BY count(*) DESC) t),
        'order_eng', (SELECT json_agg(t) FROM (SELECT order_eng AS name, count(*)::int AS count FROM filtered_species WHERE order_eng IS NOT NULL GROUP BY order_eng ORDER BY count(*) DESC) t),
        'family_eng', (SELECT json_agg(t) FROM (SELECT family_eng AS name, count(*)::int AS count FROM filtered_species WHERE family_eng IS NOT NULL GROUP BY family_eng ORDER BY count(*) DESC) t),
        'genus_eng', (SELECT json_agg(t) FROM (SELECT genus_eng AS name, count(*)::int AS count FROM filtered_species WHERE genus_eng IS NOT NULL GROUP BY genus_eng ORDER BY count(*) DESC) t),
        'informal_group_eng', (SELECT json_agg(t) FROM (SELECT informal_group_eng AS name, count(*)::int AS count FROM filtered_species WHERE informal_group_eng IS NOT NULL GROUP BY informal_group_eng ORDER BY count(*) DESC) t),
        'taxa_group', (SELECT json_agg(t) FROM (SELECT taxa_group AS name, count(*)::int AS count FROM filtered_species WHERE taxa_group IS NOT NULL GROUP BY taxa_group ORDER BY count(*) DESC) t),
        'iucn', (SELECT json_object_agg(iucn, count) FROM (SELECT iucn, count(*)::int AS count FROM filtered_species WHERE iucn IS NOT NULL GROUP BY iucn) t)
    );
$$;

INSERT INTO public.taxonomy_mappings (taxa_type, rank, name_eng, name_chi) VALUES
    ('fauna', 'taxa_group', 'Amphibian', '兩棲類'),
    ('fauna', 'taxa_group', 'Beetle', '甲蟲'),
    ('fauna', 'taxa_group', 'Bird', '鳥類'),
    ('fauna', 'taxa_group', 'Butterfly', '蝴蝶'),
    ('fauna', 'taxa_group', 'Coastal Fauna', '海岸動物'),
    ('fauna', 'taxa_group', 'Coastal Flora', '海岸植物'),
    ('fauna', 'taxa_group', 'Dragonfly', '蜻蜓'),
    ('fauna', 'taxa_group', 'Freshwater Fish', '淡水魚'),
    ('fauna', 'taxa_group', 'Mammal', '哺乳類'),
    ('fauna', 'taxa_group', 'Reptile', '爬行類')
ON CONFLICT DO NOTHING;
