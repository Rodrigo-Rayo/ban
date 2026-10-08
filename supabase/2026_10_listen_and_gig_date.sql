-- ═══════════════════════════════════════════════════════════════════════════
-- "Escuchar" en perfiles + anuncios para un bolo con fecha (2026-10-08). Idempotente.
--
-- 1. musicians.demo_url / bands.demo_url: un tema o vídeo concreto (YouTube,
--    Spotify o SoundCloud) que se escucha dentro del perfil. Opcional.
-- 2. posts.gig_date: "Buscamos músico" para un bolo concreto (un sustituto).
--    El anuncio enseña la fecha y deja de salir en Se busca cuando pasa.
--    Las alertas de Se busca ya avisan solo a quien busca ese instrumento y
--    provincia: no se manda nada más a nadie.
-- 3. Las alertas de Se busca avisan también de las vacantes de las bandas.
--
-- Solo añade columnas vacías y un aviso nuevo: no cambia ni borra nada de lo que hay.
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

-- 3. Las alertas de Se busca también avisan de las vacantes que publican las bandas
--    desde su perfil (salen en Se busca igual que un anuncio). Mismo criterio que
--    los anuncios: instrumento y provincia de la alerta. Nunca bloquea la vacante.
-- Por si el archivo de La quedada se ejecutó después que el de las alertas: 'post_alert' tiene que estar.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('message', 'application', 'rsvp', 'review', 'system', 'favorite', 'event_reminder', 'booking', 'quedada', 'post_alert')) NOT VALID;

CREATE OR REPLACE FUNCTION public.notify_vacancy_alerts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_band record;
BEGIN
  IF NEW.open IS NOT TRUE THEN RETURN NEW; END IF;
  BEGIN
    SELECT b.user_id, b.name, b.city, b.genre INTO v_band FROM public.bands b WHERE b.id = NEW.band_id;
    IF NOT FOUND THEN RETURN NEW; END IF;
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    SELECT DISTINCT a.user_id, 'post_alert',
           left('Nuevo en Se busca: ' || coalesce(nullif(btrim(v_band.name), ''), 'Una banda') || ' busca ' || lower(NEW.instrument), 120),
           concat_ws(' · ', nullif(coalesce(NEW.genre, v_band.genre), ''), nullif(v_band.city, '')),
           'band', NEW.band_id
    FROM public.post_alerts a
    WHERE a.user_id IS DISTINCT FROM v_band.user_id
      AND (a.city IS NULL OR lower(a.city) = lower(coalesce(v_band.city, '')))
      AND (a.instrument IS NULL OR lower(a.instrument) = lower(coalesce(NEW.instrument, '')));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_vacancy_alerts failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_vacancy_alerts ON public.band_vacancies;
CREATE TRIGGER trg_notify_vacancy_alerts AFTER INSERT ON public.band_vacancies
  FOR EACH ROW EXECUTE FUNCTION public.notify_vacancy_alerts();
REVOKE EXECUTE ON FUNCTION public.notify_vacancy_alerts() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar (3 filas + 1):
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND column_name IN ('demo_url', 'gig_date') ORDER BY 1;
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_notify_vacancy_alerts';
