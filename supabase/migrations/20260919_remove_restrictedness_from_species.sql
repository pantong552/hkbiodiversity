-- Remove the deprecated restrictedness field from species tables.
ALTER TABLE IF EXISTS public.species
  DROP COLUMN IF EXISTS restrictedness;

ALTER TABLE IF EXISTS public.plant_species
  DROP COLUMN IF EXISTS restrictedness;

ALTER TABLE IF EXISTS public.fungi_species
  DROP COLUMN IF EXISTS restrictedness;
