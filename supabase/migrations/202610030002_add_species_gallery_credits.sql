ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS gallery_image_credits jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.plant_species
  ADD COLUMN IF NOT EXISTS gallery_image_credits jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.fungi_species
  ADD COLUMN IF NOT EXISTS gallery_image_credits jsonb NOT NULL DEFAULT '{}'::jsonb;