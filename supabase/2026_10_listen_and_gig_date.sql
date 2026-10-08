-- ═══════════════════════════════════════════════════════════════════════════
-- "Escuchar" en perfiles + anuncios para un bolo con fecha (2026-10-08). Idempotente.
--
-- 1. musicians.demo_url / bands.demo_url: un tema o vídeo concreto (YouTube,
--    Spotify o SoundCloud) que se escucha dentro del perfil. Opcional.
-- 2. posts.gig_date: "Buscamos músico" para un bolo concreto (un sustituto).
--    El anuncio enseña la fecha y deja de salir en Se busca cuando pasa.
--    Las alertas de Se busca ya avisan solo a quien busca ese instrumento y
--    provincia: no se manda nada más a nadie.
--
-- Solo añade columnas vacías: no cambia ni borra nada de lo que hay.
-- La web ya está preparada y lo activa sola cuando existan.
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.musicians ADD COLUMN IF NOT EXISTS demo_url text;
ALTER TABLE public.bands     ADD COLUMN IF NOT EXISTS demo_url text;
ALTER TABLE public.musicians DROP CONSTRAINT IF EXISTS musicians_demo_url_check;
ALTER TABLE public.musicians ADD  CONSTRAINT musicians_demo_url_check
  CHECK (demo_url IS NULL OR (char_length(demo_url) <= 300 AND demo_url ~ '^https://')) NOT VALID;
ALTER TABLE public.bands DROP CONSTRAINT IF EXISTS bands_demo_url_check;
ALTER TABLE public.bands ADD  CONSTRAINT bands_demo_url_check
  CHECK (demo_url IS NULL OR (char_length(demo_url) <= 300 AND demo_url ~ '^https://')) NOT VALID;

-- Visible sin sesión, como el resto de enlaces del perfil (ver 2026_10_private_contact.sql).
GRANT SELECT (demo_url) ON public.musicians TO anon;
GRANT SELECT (demo_url) ON public.bands     TO anon;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS gig_date date;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_gig_date_check;
ALTER TABLE public.posts ADD  CONSTRAINT posts_gig_date_check
  CHECK (gig_date IS NULL OR (type = 'band_seeking_musician'
         AND gig_date BETWEEN (created_at AT TIME ZONE 'Europe/Madrid')::date - 1  -- Canarias / fuera de España
                          AND (created_at AT TIME ZONE 'Europe/Madrid')::date + 60)) NOT VALID;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar (3 filas):
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND column_name IN ('demo_url', 'gig_date') ORDER BY 1;
