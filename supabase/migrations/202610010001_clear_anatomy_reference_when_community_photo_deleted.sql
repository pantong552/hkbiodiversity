BEGIN;

CREATE OR REPLACE FUNCTION public.anatomy_cloudinary_asset_id(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  asset_path text;
BEGIN
  IF p_url IS NULL OR position('/upload/' IN p_url) = 0 THEN
    RETURN NULL;
  END IF;

  asset_path := split_part(p_url, '/upload/', 2);
  asset_path := regexp_replace(asset_path, '^f_auto,q_auto(,w_[0-9]+,c_limit)?/', '');
  asset_path := regexp_replace(asset_path, '^v[0-9]+/', '');
  asset_path := regexp_replace(asset_path, '\.[^./]+$', '');
  RETURN NULLIF(asset_path, '');
END;
$$;

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
              'markers', '[]'::jsonb,
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
      markers = CASE
        WHEN CASE
          WHEN asset_id IS NOT NULL THEN public.anatomy_cloudinary_asset_id(anatomy.photo_url) = asset_id
          ELSE anatomy.photo_url = photo_row.image_url
        END THEN '[]'::jsonb
        ELSE anatomy.markers
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

REVOKE ALL ON FUNCTION public.anatomy_cloudinary_asset_id(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_anatomy_reference_for_deleted_community_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_anatomy_reference_for_deleted_community_photo(text) TO authenticated;

COMMIT;