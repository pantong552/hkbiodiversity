-- Aggregated eBird summary used by SpeciesMap.
-- Import the generated CSV into this table with the Supabase dashboard CSV importer.
CREATE TABLE IF NOT EXISTS public.ebird_species_summary (
  species_code TEXT PRIMARY KEY,
  points_count INTEGER NOT NULL DEFAULT 0,
  total_records INTEGER NOT NULL DEFAULT 0,
  monthly_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ,
  grid_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.ebird_species_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to eBird species summary"
  ON public.ebird_species_summary FOR SELECT
  TO anon, authenticated
  USING (true);
