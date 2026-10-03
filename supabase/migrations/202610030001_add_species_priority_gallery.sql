CREATE OR REPLACE FUNCTION public.is_valid_species_gallery_images(p_images jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  image_url jsonb;
BEGIN
  IF jsonb_typeof(p_images) IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;

  IF jsonb_array_length(p_images) > 10 THEN
    RETURN false;
  END IF;

  FOR image_url IN SELECT value FROM jsonb_array_elements(p_images) AS images(value)
  LOOP
    IF jsonb_typeof(image_url) <> 'string' OR btrim(image_url #>> '{}') = '' THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.plant_species
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.fungi_species
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.species
SET gallery_images = jsonb_build_array(profile_picture)
WHERE gallery_images = '[]'::jsonb
  AND NULLIF(btrim(profile_picture), '') IS NOT NULL;
UPDATE public.plant_species
SET gallery_images = jsonb_build_array(profile_picture)
WHERE gallery_images = '[]'::jsonb
  AND NULLIF(btrim(profile_picture), '') IS NOT NULL;
UPDATE public.fungi_species
SET gallery_images = jsonb_build_array(profile_picture)
WHERE gallery_images = '[]'::jsonb
  AND NULLIF(btrim(profile_picture), '') IS NOT NULL;

ALTER TABLE public.species
  DROP CONSTRAINT IF EXISTS species_gallery_images_valid;
ALTER TABLE public.species
  ADD CONSTRAINT species_gallery_images_valid
    CHECK (public.is_valid_species_gallery_images(gallery_images));

ALTER TABLE public.plant_species
  DROP CONSTRAINT IF EXISTS plant_species_gallery_images_valid;
ALTER TABLE public.plant_species
  ADD CONSTRAINT plant_species_gallery_images_valid
    CHECK (public.is_valid_species_gallery_images(gallery_images));

ALTER TABLE public.fungi_species
  DROP CONSTRAINT IF EXISTS fungi_species_gallery_images_valid;
ALTER TABLE public.fungi_species
  ADD CONSTRAINT fungi_species_gallery_images_valid
    CHECK (public.is_valid_species_gallery_images(gallery_images));