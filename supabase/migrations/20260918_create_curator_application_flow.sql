-- Curator application workflow.
-- The existing profiles row stores the latest application for each user.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS curator_application_status text,
  ADD COLUMN IF NOT EXISTS curator_application_reason text,
  ADD COLUMN IF NOT EXISTS curator_application_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS curator_application_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS curator_application_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curator_application_rejection_reason text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_curator_application_status_check,
  DROP CONSTRAINT IF EXISTS profiles_curator_application_reason_length_check,
  DROP CONSTRAINT IF EXISTS profiles_curator_application_rejection_reason_length_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_curator_application_status_check
    CHECK (curator_application_status IS NULL OR curator_application_status IN ('pending', 'approved', 'rejected')),
  ADD CONSTRAINT profiles_curator_application_reason_length_check
    CHECK (curator_application_reason IS NULL OR char_length(curator_application_reason) <= 500),
  ADD CONSTRAINT profiles_curator_application_rejection_reason_length_check
    CHECK (curator_application_rejection_reason IS NULL OR char_length(curator_application_rejection_reason) <= 500);

CREATE INDEX IF NOT EXISTS profiles_curator_application_status_idx
  ON public.profiles(curator_application_status)
  WHERE curator_application_status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_curator_application_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.is_current_user_admin();
  operation text := current_setting('hkb.curator_application_operation', true);
BEGIN
  IF is_admin OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.curator_application_status IS DISTINCT FROM OLD.curator_application_status
    OR NEW.curator_application_reason IS DISTINCT FROM OLD.curator_application_reason
    OR NEW.curator_application_submitted_at IS DISTINCT FROM OLD.curator_application_submitted_at
    OR NEW.curator_application_reviewed_at IS DISTINCT FROM OLD.curator_application_reviewed_at
    OR NEW.curator_application_reviewed_by IS DISTINCT FROM OLD.curator_application_reviewed_by
    OR NEW.curator_application_rejection_reason IS DISTINCT FROM OLD.curator_application_rejection_reason
  THEN
    IF operation <> 'submit' OR auth.uid() IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Curator application fields can only be changed through the application workflow';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_curator_application_fields ON public.profiles;
CREATE TRIGGER profiles_guard_curator_application_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_curator_application_fields();

CREATE OR REPLACE FUNCTION public.submit_curator_application(p_reason text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.profiles;
  reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF char_length(reason) = 0 THEN
    RAISE EXCEPTION 'Application reason is required';
  END IF;

  IF char_length(reason) > 500 THEN
    RAISE EXCEPTION 'Application reason must be 500 characters or fewer';
  END IF;

  PERFORM set_config('hkb.curator_application_operation', 'submit', true);

  UPDATE public.profiles
  SET curator_application_status = 'pending',
      curator_application_reason = reason,
      curator_application_submitted_at = now(),
      curator_application_reviewed_at = NULL,
      curator_application_reviewed_by = NULL,
      curator_application_rejection_reason = NULL,
      updated_at = now()
  WHERE id = auth.uid()
    AND role = 'guest'
    AND (curator_application_status IS NULL OR curator_application_status = 'rejected')
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Only a guest without a pending application can apply';
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_curator_application(
  p_user_id uuid,
  p_decision text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.profiles;
  rejection_reason text := btrim(coalesce(p_rejection_reason, ''));
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only active administrators can review applications';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid application decision';
  END IF;

  IF p_decision = 'rejected' AND char_length(rejection_reason) = 0 THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  IF char_length(rejection_reason) > 500 THEN
    RAISE EXCEPTION 'Rejection reason must be 500 characters or fewer';
  END IF;

  PERFORM set_config('hkb.curator_application_operation', 'review', true);

  UPDATE public.profiles
  SET curator_application_status = p_decision,
      role = CASE WHEN p_decision = 'approved' THEN 'curator' ELSE role END,
      curator_application_reviewed_at = now(),
      curator_application_reviewed_by = auth.uid(),
      curator_application_rejection_reason = CASE
        WHEN p_decision = 'rejected' THEN rejection_reason
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = p_user_id
    AND role = 'guest'
    AND curator_application_status = 'pending'
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Application is no longer pending';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_curator_application(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_curator_application(text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_curator_application(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_curator_application(uuid, text, text) TO authenticated;

