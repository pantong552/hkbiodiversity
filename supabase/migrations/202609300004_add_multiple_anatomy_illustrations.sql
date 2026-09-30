BEGIN;

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

ALTER TABLE public.species_anatomy_illustrations
  ADD COLUMN IF NOT EXISTS illustrations JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.species_anatomy_illustrations
SET illustrations = jsonb_build_array(jsonb_build_object(
  'id', 'illustration-1',
  'photo_url', photo_url,
  'photo_attribution', photo_attribution,
  'photo_link', photo_link,
  'markers', markers,
  'image_zoom', image_zoom,
  'image_offset_x', image_offset_x,
  'image_offset_y', image_offset_y
))
WHERE illustrations = '[]'::jsonb
  AND (photo_url <> '' OR markers <> '[]'::jsonb OR photo_attribution <> '' OR photo_link <> '');

ALTER TABLE public.species_anatomy_illustrations
  DROP CONSTRAINT IF EXISTS species_anatomy_illustrations_illustrations_valid;
ALTER TABLE public.species_anatomy_illustrations
  ADD CONSTRAINT species_anatomy_illustrations_illustrations_valid
    CHECK (public.is_valid_anatomy_illustrations(illustrations));

COMMIT;