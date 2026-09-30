-- Portable schema for interactive anatomy hotspots.
-- Public read is allowed; write access must be granted only through the target app's admin RLS model.

BEGIN;

CREATE TABLE IF NOT EXISTS public.species_anatomy_hotspots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species_id UUID NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
    hotspot_key VARCHAR(50) NOT NULL,
    x_percent NUMERIC(5,2) NOT NULL CHECK (x_percent >= 0 AND x_percent <= 100),
    y_percent NUMERIC(5,2) NOT NULL CHECK (y_percent >= 0 AND y_percent <= 100),
    placement VARCHAR(30) NOT NULL DEFAULT 'top',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (species_id, hotspot_key)
);

CREATE TABLE IF NOT EXISTS public.species_anatomy_hotspot_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotspot_id UUID NOT NULL REFERENCES public.species_anatomy_hotspots(id) ON DELETE CASCADE,
    lang VARCHAR(5) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (hotspot_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_species_anatomy_hotspots_species_id
    ON public.species_anatomy_hotspots(species_id);

CREATE INDEX IF NOT EXISTS idx_species_anatomy_hotspot_translations_hotspot_id
    ON public.species_anatomy_hotspot_translations(hotspot_id);

ALTER TABLE public.species_anatomy_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species_anatomy_hotspot_translations ENABLE ROW LEVEL SECURITY;

-- Remove the permissive policies used by the source app's legacy setup script.
DROP POLICY IF EXISTS "Allow all operations for public species_anatomy_hotspots"
    ON public.species_anatomy_hotspots;
DROP POLICY IF EXISTS "Allow all operations for public species_anatomy_hotspot_translations"
    ON public.species_anatomy_hotspot_translations;

DROP POLICY IF EXISTS "Allow public read species_anatomy_hotspots"
    ON public.species_anatomy_hotspots;
CREATE POLICY "Allow public read species_anatomy_hotspots"
    ON public.species_anatomy_hotspots FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public read species_anatomy_hotspot_translations"
    ON public.species_anatomy_hotspot_translations;
CREATE POLICY "Allow public read species_anatomy_hotspot_translations"
    ON public.species_anatomy_hotspot_translations FOR SELECT TO anon, authenticated USING (true);

REVOKE ALL ON TABLE public.species_anatomy_hotspots FROM anon, authenticated;
REVOKE ALL ON TABLE public.species_anatomy_hotspot_translations FROM anon, authenticated;
GRANT SELECT ON TABLE public.species_anatomy_hotspots TO anon, authenticated;
GRANT SELECT ON TABLE public.species_anatomy_hotspot_translations TO anon, authenticated;

COMMIT;
