-- ═══════════════════════════════════════════════════════════════════════════
-- "También doy clases" + alertas de Se busca (2026-10-06). Idempotente.
--
-- 1) musicians.gives_lessons: un músico puede marcar que también da clases y
--    sale en Buscar → Clases sin crear otro perfil.
-- 2) post_alerts: "Avísame cuando alguien busque <instrumento> en <provincia>".
--    Al publicarse un anuncio que encaja, quien tiene la alerta recibe una
--    notificación en la web (campana). Máximo 5 alertas por persona.
--
-- La web detecta las columnas/tablas solas (MediaFeaturesService
-- 'giveLessons' y 'postAlerts'): mientras no se ejecute esto, no aparece nada.
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- El aviso usa posts.title (2026_10_post_title.sql); por si no se ejecutó aquel archivo.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title text;

-- ── 1) También doy clases ─────────────────────────────────────────────────
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS gives_lessons boolean NOT NULL DEFAULT false;
-- musicians tiene permisos por columna para anon (2026_10_private_contact.sql):
-- una columna nueva no es legible sin sesión hasta concederla.
GRANT SELECT (gives_lessons) ON public.musicians TO anon;
CREATE INDEX IF NOT EXISTS musicians_gives_lessons_idx ON musicians (city) WHERE gives_lessons;

-- ── 2) Alertas de Se busca ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city        text CHECK (city IS NULL OR (btrim(city) <> '' AND char_length(city) <= 60)),
  instrument  text CHECK (instrument IS NULL OR (btrim(instrument) <> '' AND char_length(instrument) <= 40)),
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Una alerta sin provincia ni instrumento avisaría de TODOS los anuncios.
ALTER TABLE post_alerts DROP CONSTRAINT IF EXISTS post_alerts_not_empty;
ALTER TABLE post_alerts ADD CONSTRAINT post_alerts_not_empty CHECK (city IS NOT NULL OR instrument IS NOT NULL);
-- Misma alerta dos veces no tiene sentido ('' = cualquiera).
CREATE UNIQUE INDEX IF NOT EXISTS post_alerts_unique
  ON post_alerts (user_id, coalesce(city, ''), coalesce(instrument, ''));
CREATE INDEX IF NOT EXISTS post_alerts_city_idx ON post_alerts (lower(city));
CREATE INDEX IF NOT EXISTS post_alerts_instrument_idx ON post_alerts (lower(instrument));

ALTER TABLE post_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_alerts own read"   ON post_alerts;
DROP POLICY IF EXISTS "post_alerts own insert" ON post_alerts;
DROP POLICY IF EXISTS "post_alerts own delete" ON post_alerts;
CREATE POLICY "post_alerts own read"   ON post_alerts FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "post_alerts own insert" ON post_alerts FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "post_alerts own delete" ON post_alerts FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON post_alerts FROM anon;
GRANT SELECT, INSERT, DELETE ON post_alerts TO authenticated;

-- Máximo 5 alertas por persona.
CREATE OR REPLACE FUNCTION public.post_alerts_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('post_alerts:' || NEW.user_id::text));
  IF (SELECT count(*) FROM public.post_alerts WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Máximo 5 alertas' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_post_alerts_limit ON post_alerts;
CREATE TRIGGER trg_post_alerts_limit BEFORE INSERT ON post_alerts
  FOR EACH ROW EXECUTE FUNCTION public.post_alerts_limit();
REVOKE EXECUTE ON FUNCTION public.post_alerts_limit() FROM PUBLIC, anon, authenticated;

-- Nuevo tipo de notificación.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('message', 'application', 'rsvp', 'review', 'system', 'favorite', 'event_reminder', 'booking', 'quedada', 'post_alert')) NOT VALID;

-- Al publicarse un anuncio de Se busca: una notificación por persona con alguna alerta
-- que encaje. Nunca bloquea la publicación: si algo falla, el anuncio se guarda igual.
CREATE OR REPLACE FUNCTION public.notify_post_alerts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_title text;
BEGIN
  IF NEW.type NOT IN ('musician_seeking_band', 'band_seeking_musician', 'looking_for_rehearsal', 'collab', 'session_offer', 'other') THEN
    RETURN NEW;
  END IF;
  BEGIN
    v_title := left(coalesce(nullif(btrim(NEW.title), ''), nullif(btrim(NEW.text), ''), 'Nuevo anuncio'), 90);
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    SELECT DISTINCT a.user_id, 'post_alert', 'Nuevo en Se busca: ' || v_title,
           concat_ws(' · ', nullif(NEW.instrument, ''), nullif(NEW.city, ''), nullif(NEW.author_name, '')),
           'post', NEW.id
    FROM public.post_alerts a
    WHERE a.user_id <> NEW.user_id
      AND (a.city IS NULL OR lower(a.city) = lower(coalesce(NEW.city, '')))
      AND (a.instrument IS NULL OR lower(a.instrument) = lower(coalesce(NEW.instrument, '')));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_post_alerts failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_post_alerts ON posts;
CREATE TRIGGER trg_notify_post_alerts AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_alerts();
REVOKE EXECUTE ON FUNCTION public.notify_post_alerts() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar:
--   SELECT gives_lessons FROM musicians LIMIT 1;
--   SELECT * FROM post_alerts LIMIT 1;
