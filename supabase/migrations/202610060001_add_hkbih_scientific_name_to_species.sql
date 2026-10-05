ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS hkbih_scientific_name text;
