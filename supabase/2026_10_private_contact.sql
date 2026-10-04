-- ═══════════════════════════════════════════════════════════════════════════
-- Contacto privado en los perfiles (2026-10-04). Idempotente.
--
-- 1) Teléfono opcional también para músicos, bandas y profesores (salas y
--    locales ya lo tenían). El email de contacto ya existía en las 5 tablas.
-- 2) has_contact: columna calculada (true si hay email o teléfono). Es lo único
--    que ve un visitante sin sesión, para mostrar "Inicia sesión para ver el
--    contacto" solo cuando hay algo que ver.
-- 3) El email y el teléfono dejan de poder leerse sin sesión (rol anon): se
--    retira el SELECT de la tabla entera y se concede columna a columna, todas
--    menos contact_email y phone. Los usuarios con sesión los siguen viendo.
--    OJO: una columna que se añada en el futuro a estas tablas NO será legible
--    sin sesión hasta volver a ejecutar el bloque 3.
--
-- Supabase → SQL Editor → pegar todo → Run. (La web ya está preparada.)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Teléfono ───────────────────────────────────────────────────────────
ALTER TABLE musicians        ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE bands            ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE venues           ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE teachers         ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE venues           ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE bands     ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE teachers  ADD COLUMN IF NOT EXISTS phone text;

-- ── 2) has_contact + límites de longitud ─────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'] LOOP
    EXECUTE format($f$
      ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS has_contact boolean
        GENERATED ALWAYS AS (coalesce(contact_email, '') <> '' OR coalesce(phone, '') <> '') STORED$f$, t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_phone_len');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (phone IS NULL OR char_length(phone) <= 30) NOT VALID', t, t || '_phone_len');
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_contact_email_len');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (contact_email IS NULL OR char_length(contact_email) <= 254) NOT VALID', t, t || '_contact_email_len');
  END LOOP;
END;
$$;

-- ── 3) Sin sesión no se leen email ni teléfono ───────────────────────────
DO $$
DECLARE
  t text;
  cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'] LOOP
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name NOT IN ('contact_email', 'phone');
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon', cols, t);
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificar ─────────────────────────────────────────────────────────────
--   Sin sesión (anon): GET /rest/v1/venues?select=contact_email → 401/permission denied
--                      GET /rest/v1/venues?select=has_contact   → 200
