BEGIN;

CREATE OR REPLACE FUNCTION public.clear_anatomy_reference_for_deleted_community_photo(p_photo_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  photo_row public.species_community_photos%ROWTYPE;
  asset_id text;
  changed_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO photo_row
  FROM public.species_community_photos
  WHERE id::text = p_photo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF photo_row.user_id IS DISTINCT FROM auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'curator')
    ) THEN
    RAISE EXCEPTION 'Not authorized to delete this photo' USING ERRCODE = '42501';
  END IF;

  asset_id := COALESCE(
    NULLIF(photo_row.cloudinary_public_id, ''),
    public.anatomy_cloudinary_asset_id(photo_row.image_url)
  );

  UPDATE public.species_anatomy_illustrations AS anatomy
  SET illustrations = (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN CASE
              WHEN asset_id IS NOT NULL THEN public.anatomy_cloudinary_asset_id(COALESCE(item->>'photo_url', item->>'photoUrl')) = asset_id
              ELSE COALESCE(item->>'photo_url', item->>'photoUrl') = photo_row.image_url
            END THEN item || jsonb_build_object(
              'photo_url', '', 'photoUrl', '',
              'photo_attribution', '', 'photoAttribution', '',
              'photo_link', '', 'photoLink', '',
              'image_zoom', 1, 'zoom', 1,
              'image_offset_x', 0, 'offsetX', 0,
              'image_offset_y', 0, 'offsetY', 0
            )
            ELSE item
          END ORDER BY item_order
        ), '[]'::jsonb)
        FROM jsonb_array_elements(anatomy.illustrations) WITH ORDINALITY AS entries(item, item_order)
      ),
      photo_url = CASE
        WHEN CASE
          WHEN asset_id IS NOT NULL THEN public.anatomy_cloudinary_asset_id(anatomy.photo_url) = asset_id
          ELSE anatomy.photo_url = photo_row.image_url
        END THEN ''
        ELSE anatomy.photo_url
      END,
      photo_attribution = CASE
        WHEN CASE
          WHEN asset_id IS NOT NULL THEN public.anatomy_cloudinary_asset_id(anatomy.photo_url) = asset_id
          ELSE anatomy.photo_url = photo_row.image_url
        END THEN ''
        ELSE anatomy.photo_attribution
      END,
      photo_link = CASE
        WHEN CASE
          WHEN asset_id IS NOT NULL THEN public.anatomy_cloudinary_asset_id(anatomy.photo_url) = asset_id
          ELSE anatomy.photo_url = photo_row.image_url
        END THEN ''
        ELSE anatomy.photo_link
      END,
      image_zoom = CASE
        WHEN CASE
          WHEN asset_id IS NOT NULL THEN public.anatomy_cloudinary_asset_id(anatomy.photo_url) = asset_id
          ELSE anatomy.photo_url = photo_row.image_url
        END THEN 1
        ELSE anatomy.image_zoom
      END,
      image_offset_x = CASE
        WHEN CASE
          WHEN asset_id IS NOT NULL THEN public.anatomy_cloudinary_asset_id(anatomy.photo_url) = asset_id
          ELSE anatomy.photo_url = photo_row.image_url
        END THEN 0
        ELSE anatomy.image_offset_x
      END,
      image_offset_y = CASE
        WHEN CASE
          WHEN asset_id IS NOT NULL THEN public.anatomy_cloudinary_asset_id(anatomy.photo_url) = asset_id
          ELSE anatomy.photo_url = photo_row.image_url
        END THEN 0
        ELSE anatomy.image_offset_y
      END,
      updated_at = now()
  WHERE CASE
    WHEN asset_id IS NOT NULL THEN
      public.anatomy_cloudinary_asset_id(anatomy.photo_url) = asset_id
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(anatomy.illustrations) AS illustrations(item)
        WHERE public.anatomy_cloudinary_asset_id(COALESCE(item->>'photo_url', item->>'photoUrl')) = asset_id
      )
    ELSE
      anatomy.photo_url = photo_row.image_url
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(anatomy.illustrations) AS illustrations(item)
        WHERE COALESCE(item->>'photo_url', item->>'photoUrl') = photo_row.image_url
      )
  END;

  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  RETURN changed_rows > 0;
END;
$$;

COMMIT;