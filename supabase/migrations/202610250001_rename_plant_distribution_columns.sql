ALTER TABLE public.plant_species
  RENAME COLUMN locality_eng TO local_distribution_eng;

ALTER TABLE public.plant_species
  RENAME COLUMN locality_chi TO local_distribution_chi;

ALTER TABLE public.plant_species
  RENAME COLUMN distribution_eng TO global_distribution_eng;

ALTER TABLE public.plant_species
  RENAME COLUMN distribution_chi TO global_distribution_chi;
