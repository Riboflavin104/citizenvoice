-- ============================================================
-- Aadhaar masking migration (corrected)
-- ============================================================

-- 1. Add column — IF NOT EXISTS IS valid here
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS aadhaar_masked TEXT;

-- 2. Add CHECK constraint safely
--    Postgres has NO "ADD CONSTRAINT IF NOT EXISTS" — must check manually
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'aadhaar_masked_format_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT aadhaar_masked_format_check
    CHECK (aadhaar_masked ~ '^X{8}[0-9]{4}$');
  END IF;
END $$;

-- 3. Update handle_new_user() trigger function
--    SECURITY DEFINER + search_path needed so it can write to public.profiles
--    Keep your existing column list; only aadhaar_masked is new here
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, aadhaar_masked)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'aadhaar_masked'
  )
  ON CONFLICT (id) DO UPDATE
    SET aadhaar_masked = EXCLUDED.aadhaar_masked;

  RETURN NEW;
END;
$$;

-- 4. Re-attach trigger (only needed if it was dropped/recreated)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();