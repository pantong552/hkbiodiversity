BEGIN;

ALTER TABLE public.species_anatomy_illustrations
  ADD COLUMN IF NOT EXISTS title_zh TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_en TEXT NOT NULL DEFAULT '';

ALTER TABLE public.species_anatomy_illustrations
  DROP CONSTRAINT IF EXISTS species_anatomy_illustrations_illustrations_valid;

CREATE OR REPLACE FUNCTION public.is_valid_anatomy_illustrations(p_illustrations jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  illustration jsonb;
  illustration_id text;
  seen_ids text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(p_illustrations) <> 'array' THEN
    RETURN false;
  END IF;

  FOR illustration IN SELECT value FROM jsonb_array_elements(p_illustrations) AS items(value)
  LOOP
    IF jsonb_typeof(illustration) <> 'object'
      OR jsonb_typeof(illustration->'id') <> 'string'
      OR jsonb_typeof(illustration->'title_zh') <> 'string'
      OR jsonb_typeof(illustration->'title_en') <> 'string'
      OR jsonb_typeof(illustration->'photo_url') <> 'string'
      OR jsonb_typeof(illustration->'photo_attribution') <> 'string'
      OR jsonb_typeof(illustration->'photo_link') <> 'string'
      OR jsonb_typeof(illustration->'image_zoom') <> 'number'
      OR jsonb_typeof(illustration->'image_offset_x') <> 'number'
      OR jsonb_typeof(illustration->'image_offset_y') <> 'number'
      OR NOT public.is_valid_anatomy_markers(illustration->'markers') THEN
      RETURN false;
    END IF;

    illustration_id := btrim(illustration->>'id');
    IF illustration_id = '' OR illustration_id = ANY(seen_ids) THEN
      RETURN false;
    END IF;
    IF (illustration->>'photo_url') <> ''
      AND (illustration->>'photo_url') !~* '^https://'
      AND NOT ((illustration->>'photo_url') LIKE '/%' AND (illustration->>'photo_url') NOT LIKE '//%') THEN
      RETURN false;
    END IF;
    IF (illustration->>'photo_link') <> ''
      AND (illustration->>'photo_link') !~* '^https://(www\.)?inaturalist\.org/' THEN
      RETURN false;
    END IF;
    IF (illustration->>'image_zoom')::numeric < 1 OR (illustration->>'image_zoom')::numeric > 4
      OR (illustration->>'image_offset_x')::numeric < -100 OR (illustration->>'image_offset_x')::numeric > 100
      OR (illustration->>'image_offset_y')::numeric < -100 OR (illustration->>'image_offset_y')::numeric > 100 THEN
      RETURN false;
    END IF;

    seen_ids := array_append(seen_ids, illustration_id);
  END LOOP;

  RETURN true;
END;
$$;

UPDATE public.species_anatomy_illustrations AS saved
SET illustrations = (
  SELECT COALESCE(
    jsonb_agg(
      item.value || jsonb_build_object(
        'title_zh', COALESCE(item.value->>'title_zh', CASE WHEN item.ordinality = 1 THEN saved.title_zh ELSE '' END, ''),
        'title_en', COALESCE(item.value->>'title_en', CASE WHEN item.ordinality = 1 THEN saved.title_en ELSE '' END, '')
      )
      ORDER BY item.ordinality
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(saved.illustrations) WITH ORDINALITY AS item(value, ordinality)
),
title_zh = COALESCE((
  SELECT item.value->>'title_zh'
  FROM jsonb_array_elements(saved.illustrations) WITH ORDINALITY AS item(value, ordinality)
  WHERE item.ordinality = 1
), saved.title_zh),
title_en = COALESCE((
  SELECT item.value->>'title_en'
  FROM jsonb_array_elements(saved.illustrations) WITH ORDINALITY AS item(value, ordinality)
  WHERE item.ordinality = 1
), saved.title_en)
WHERE saved.illustrations <> '[]'::jsonb;

ALTER TABLE public.species_anatomy_illustrations
  ADD CONSTRAINT species_anatomy_illustrations_illustrations_valid
    CHECK (public.is_valid_anatomy_illustrations(illustrations));

COMMIT;