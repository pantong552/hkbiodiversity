-- Create species_drafts table to store curator edit drafts & review history
CREATE TABLE IF NOT EXISTS public.species_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species_id TEXT NOT NULL,
    table_name TEXT NOT NULL DEFAULT 'species', -- 'species' or 'plant_species'
    curator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    curator_name TEXT,
    curator_avatar TEXT,
    draft_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by_name TEXT,
    approved_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.species_drafts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read approved or own species_drafts" ON public.species_drafts;
DROP POLICY IF EXISTS "Allow authenticated users to insert species_drafts" ON public.species_drafts;
DROP POLICY IF EXISTS "Allow authenticated users to update species_drafts" ON public.species_drafts;
DROP POLICY IF EXISTS "Allow authenticated users to delete species_drafts" ON public.species_drafts;

-- Create RLS Policies
CREATE POLICY "Allow public read approved or own species_drafts" ON public.species_drafts
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert species_drafts" ON public.species_drafts
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update species_drafts" ON public.species_drafts
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete species_drafts" ON public.species_drafts
    FOR DELETE TO authenticated USING (true);

-- Create Index for fast queries by species_id & status
CREATE INDEX IF NOT EXISTS idx_species_drafts_species_id ON public.species_drafts(species_id);
CREATE INDEX IF NOT EXISTS idx_species_drafts_status ON public.species_drafts(status);
