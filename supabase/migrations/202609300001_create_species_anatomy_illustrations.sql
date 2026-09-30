BEGIN;

CREATE OR REPLACE FUNCTION public.is_valid_anatomy_markers(markers jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  marker jsonb;
  marker_key text;
  seen_keys text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(markers) <> 'array' THEN
    RETURN false;
  END IF;

  FOR marker IN SELECT value FROM jsonb_array_elements(markers) AS items(value)
  LOOP
    IF jsonb_typeof(marker) <> 'object'
      OR jsonb_typeof(marker->'key') <> 'string'
      OR jsonb_typeof(marker->'x') <> 'number'
      OR jsonb_typeof(marker->'y') <> 'number'
      OR jsonb_typeof(marker->'zh') <> 'string'
      OR jsonb_typeof(marker->'en') <> 'string' THEN
      RETURN false;
    END IF;

    marker_key := btrim(marker->>'key');
    IF marker_key = '' OR char_length(marker_key) > 50 OR marker_key = ANY(seen_keys) THEN
      RETURN false;
    END IF;
    IF (marker->>'x')::numeric < 0 OR (marker->>'x')::numeric > 100
      OR (marker->>'y')::numeric < 0 OR (marker->>'y')::numeric > 100 THEN
      RETURN false;
    END IF;

    seen_keys := array_append(seen_keys, marker_key);
  END LOOP;

  RETURN true;
END;
$$;

CREATE TABLE IF NOT EXISTS public.species_anatomy_illustrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL CHECK (table_name IN ('species', 'plant_species', 'fungi_species')),
  species_taxa_id text NOT NULL,
  photo_url text NOT NULL DEFAULT '',
  markers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_name, species_taxa_id),
  CHECK (photo_url = '' OR photo_url ~* '^https://' OR (photo_url LIKE '/%' AND photo_url NOT LIKE '//%')),
  CHECK (public.is_valid_anatomy_markers(markers))
);

CREATE INDEX IF NOT EXISTS idx_species_anatomy_illustrations_species
  ON public.species_anatomy_illustrations(table_name, species_taxa_id);

ALTER TABLE public.species_anatomy_illustrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read species anatomy illustrations"
  ON public.species_anatomy_illustrations;
CREATE POLICY "Public can read species anatomy illustrations"
  ON public.species_anatomy_illustrations FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert species anatomy illustrations"
  ON public.species_anatomy_illustrations;
CREATE POLICY "Admins can insert species anatomy illustrations"
  ON public.species_anatomy_illustrations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can update species anatomy illustrations"
  ON public.species_anatomy_illustrations;
CREATE POLICY "Admins can update species anatomy illustrations"
  ON public.species_anatomy_illustrations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can delete species anatomy illustrations"
  ON public.species_anatomy_illustrations;
CREATE POLICY "Admins can delete species anatomy illustrations"
  ON public.species_anatomy_illustrations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

REVOKE ALL ON public.species_anatomy_illustrations FROM anon, authenticated;
GRANT SELECT ON public.species_anatomy_illustrations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.species_anatomy_illustrations TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_species_anatomy_illustration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.species_anatomy_illustrations
  WHERE table_name = TG_TABLE_NAME AND species_taxa_id = OLD.taxa_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS species_delete_anatomy_illustration ON public.species;
CREATE TRIGGER species_delete_anatomy_illustration
  AFTER DELETE ON public.species
  FOR EACH ROW EXECUTE FUNCTION public.delete_species_anatomy_illustration();

DROP TRIGGER IF EXISTS plant_species_delete_anatomy_illustration ON public.plant_species;
CREATE TRIGGER plant_species_delete_anatomy_illustration
  AFTER DELETE ON public.plant_species
  FOR EACH ROW EXECUTE FUNCTION public.delete_species_anatomy_illustration();

DROP TRIGGER IF EXISTS fungi_species_delete_anatomy_illustration ON public.fungi_species;
CREATE TRIGGER fungi_species_delete_anatomy_illustration
  AFTER DELETE ON public.fungi_species
  FOR EACH ROW EXECUTE FUNCTION public.delete_species_anatomy_illustration();

COMMIT;