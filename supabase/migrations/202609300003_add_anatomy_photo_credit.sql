BEGIN;

ALTER TABLE public.species_anatomy_illustrations
  ADD COLUMN IF NOT EXISTS photo_attribution TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_link TEXT NOT NULL DEFAULT '';

ALTER TABLE public.species_anatomy_illustrations
  DROP CONSTRAINT IF EXISTS species_anatomy_illustrations_photo_link_inaturalist;

ALTER TABLE public.species_anatomy_illustrations
  ADD CONSTRAINT species_anatomy_illustrations_photo_link_inaturalist
    CHECK (photo_link = '' OR photo_link ~* '^https://(www\.)?inaturalist\.org/');

COMMIT;