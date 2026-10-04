ALTER TABLE public.species_community_photos
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'photo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'species_community_photos_media_type_check'
      AND conrelid = 'public.species_community_photos'::regclass
  ) THEN
    ALTER TABLE public.species_community_photos
      ADD CONSTRAINT species_community_photos_media_type_check
      CHECK (media_type IN ('photo', 'illustration'));
  END IF;
END $$;
