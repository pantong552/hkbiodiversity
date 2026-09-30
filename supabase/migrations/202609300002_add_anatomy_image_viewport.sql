BEGIN;

ALTER TABLE public.species_anatomy_illustrations
  ADD COLUMN IF NOT EXISTS image_zoom NUMERIC(5,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS image_offset_x NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_offset_y NUMERIC(6,2) NOT NULL DEFAULT 0;

ALTER TABLE public.species_anatomy_illustrations
  DROP CONSTRAINT IF EXISTS species_anatomy_illustrations_image_zoom_range,
  DROP CONSTRAINT IF EXISTS species_anatomy_illustrations_image_offset_x_range,
  DROP CONSTRAINT IF EXISTS species_anatomy_illustrations_image_offset_y_range;

ALTER TABLE public.species_anatomy_illustrations
  ADD CONSTRAINT species_anatomy_illustrations_image_zoom_range
    CHECK (image_zoom >= 1 AND image_zoom <= 4),
  ADD CONSTRAINT species_anatomy_illustrations_image_offset_x_range
    CHECK (image_offset_x >= -100 AND image_offset_x <= 100),
  ADD CONSTRAINT species_anatomy_illustrations_image_offset_y_range
    CHECK (image_offset_y >= -100 AND image_offset_y <= 100);

COMMIT;