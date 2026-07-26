-- Add DELETE policy to species_drafts table
DROP POLICY IF EXISTS "Allow authenticated users to delete species_drafts" ON public.species_drafts;

CREATE POLICY "Allow authenticated users to delete species_drafts" ON public.species_drafts
    FOR DELETE TO authenticated USING (true);
