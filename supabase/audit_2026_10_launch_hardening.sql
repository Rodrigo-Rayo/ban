-- ═══════════════════════════════════════════════════════════════════════════
-- Refuerzo antes del lanzamiento / pre-launch hardening. Idempotente.
--
--  1) Límites de ritmo por usuario (antispam): Se busca (10/h), mensajes (60/min), eventos (10/día),
--     Tienda (20/día), reseñas (20/día) y favoritos (100/h).
--  2) Longitud máxima de los textos (NOT VALID: no toca filas antiguas).
--  3) La autoría de anuncios y artículos la fija el servidor: nadie puede
--     publicar con el nombre o el enlace de otro perfil.
--  4) El bucket 'media' deja de poder listarse anónimamente (las URLs públicas
--     siguen funcionando: un bucket público sirve archivos sin política SELECT).
--
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Rate limits ─────────────────────────────────────────────────────────
-- One generic trigger function; each table passes its own owner column,
-- window and maximum as trigger arguments.
CREATE OR REPLACE FUNCTION enforce_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_col  text     := TG_ARGV[0];
  max_rows   int      := TG_ARGV[1]::int;
  win        interval := TG_ARGV[2]::interval;
  owner_id   uuid;
  recent     int;
BEGIN
  EXECUTE format('SELECT ($1).%I', owner_col) INTO owner_id USING NEW;
  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1 AND created_at > now() - $2',
                 TG_TABLE_SCHEMA, TG_TABLE_NAME, owner_col)
    INTO recent USING owner_id, win;
  IF recent >= max_rows THEN
    RAISE EXCEPTION 'Has publicado demasiado en poco tiempo. Espera un poco e inténtalo de nuevo.'
      USING ERRCODE = 'P0001', HINT = 'rate_limit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_posts ON posts;
CREATE TRIGGER trg_rate_posts BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION enforce_rate_limit('user_id', '10', '1 hour');

DROP TRIGGER IF EXISTS trg_rate_messages ON messages;
CREATE TRIGGER trg_rate_messages BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION enforce_rate_limit('sender_id', '60', '1 minute');

DROP TRIGGER IF EXISTS trg_rate_events ON events;
CREATE TRIGGER trg_rate_events BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_rate_limit('user_id', '10', '1 day');

DROP TRIGGER IF EXISTS trg_rate_gear ON gear_listings;
CREATE TRIGGER trg_rate_gear BEFORE INSERT ON gear_listings
  FOR EACH ROW EXECUTE FUNCTION enforce_rate_limit('user_id', '20', '1 day');

DROP TRIGGER IF EXISTS trg_rate_reviews ON reviews;
CREATE TRIGGER trg_rate_reviews BEFORE INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION enforce_rate_limit('user_id', '20', '1 day');

DROP TRIGGER IF EXISTS trg_rate_favorites ON favorites;
CREATE TRIGGER trg_rate_favorites BEFORE INSERT ON favorites
  FOR EACH ROW EXECUTE FUNCTION enforce_rate_limit('user_id', '100', '1 hour');

-- Indexes that keep those counts cheap.
CREATE INDEX IF NOT EXISTS posts_user_created_idx         ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_created_idx    ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_user_created_idx        ON events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gear_listings_user_created_idx ON gear_listings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_user_created_idx       ON reviews (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_user_created_idx     ON favorites (user_id, created_at DESC);

-- ── 2) Text length caps (generous: the app limits are lower) ─────────────
ALTER TABLE posts         DROP CONSTRAINT IF EXISTS posts_text_len;
ALTER TABLE posts         ADD  CONSTRAINT posts_text_len         CHECK (char_length(text) <= 2000) NOT VALID;
ALTER TABLE events        DROP CONSTRAINT IF EXISTS events_description_len;
ALTER TABLE events        ADD  CONSTRAINT events_description_len CHECK (description IS NULL OR char_length(description) <= 4000) NOT VALID;
ALTER TABLE events        DROP CONSTRAINT IF EXISTS events_title_len;
ALTER TABLE events        ADD  CONSTRAINT events_title_len       CHECK (char_length(title) <= 200) NOT VALID;
ALTER TABLE gear_listings DROP CONSTRAINT IF EXISTS gear_description_len;
ALTER TABLE gear_listings ADD  CONSTRAINT gear_description_len   CHECK (description IS NULL OR char_length(description) <= 4000) NOT VALID;
ALTER TABLE gear_listings DROP CONSTRAINT IF EXISTS gear_title_len;
ALTER TABLE gear_listings ADD  CONSTRAINT gear_title_len         CHECK (char_length(title) <= 200) NOT VALID;
ALTER TABLE reviews       DROP CONSTRAINT IF EXISTS reviews_comment_len;
ALTER TABLE reviews       ADD  CONSTRAINT reviews_comment_len    CHECK (comment IS NULL OR char_length(comment) <= 2000) NOT VALID;

-- ── 3) Server-side authorship ────────────────────────────────────────────
-- A user's own profile (one row across the five profile tables).
DROP FUNCTION IF EXISTS caller_profile();
CREATE OR REPLACE FUNCTION owner_profile(uid uuid, OUT p_type text, OUT p_id uuid, OUT p_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  SELECT 'musician', id, name INTO p_type, p_id, p_name FROM musicians WHERE user_id = uid LIMIT 1;
  IF p_id IS NOT NULL THEN RETURN; END IF;
  SELECT 'band', id, name INTO p_type, p_id, p_name FROM bands WHERE user_id = uid LIMIT 1;
  IF p_id IS NOT NULL THEN RETURN; END IF;
  SELECT 'venue', id, name INTO p_type, p_id, p_name FROM venues WHERE user_id = uid LIMIT 1;
  IF p_id IS NOT NULL THEN RETURN; END IF;
  SELECT 'teacher', id, name INTO p_type, p_id, p_name FROM teachers WHERE user_id = uid LIMIT 1;
  IF p_id IS NOT NULL THEN RETURN; END IF;
  SELECT 'rehearsal', id, name INTO p_type, p_id, p_name FROM rehearsal_spaces WHERE user_id = uid LIMIT 1;
  IF p_id IS NOT NULL THEN RETURN; END IF;
  p_type := NULL; p_id := NULL;
  SELECT name INTO p_name FROM profiles WHERE id = uid;
END;
$$;

CREATE OR REPLACE FUNCTION set_post_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cp record;
BEGIN
  -- Seeds / SQL editor (no signed-in user): keep what was given.
  IF auth.uid() IS NULL OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO cp FROM owner_profile(NEW.user_id);
  NEW.author_profile_type := cp.p_type;
  NEW.author_profile_id   := cp.p_id;
  NEW.author_name         := COALESCE(NULLIF(trim(cp.p_name), ''), 'Usuario');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_author ON posts;
CREATE TRIGGER trg_post_author BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION set_post_author();

CREATE OR REPLACE FUNCTION set_gear_seller()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cp record;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO cp FROM owner_profile(NEW.user_id);
  NEW.seller_profile_type := cp.p_type;
  NEW.seller_profile_id   := cp.p_id;
  NEW.seller_name         := COALESCE(NULLIF(trim(cp.p_name), ''), 'Usuario');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gear_seller ON gear_listings;
CREATE TRIGGER trg_gear_seller BEFORE INSERT ON gear_listings
  FOR EACH ROW EXECUTE FUNCTION set_gear_seller();

-- Internal helpers: never callable through the API (triggers run them as owner).
REVOKE EXECUTE ON FUNCTION owner_profile(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION enforce_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_post_author()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_gear_seller()    FROM PUBLIC, anon, authenticated;

-- ── 4) 'media' bucket: no anonymous listing ──────────────────────────────
-- Public buckets serve /object/public/... without any SELECT policy. Listing is
-- kept only for the owner's own folder (the app uses it to delete its files
-- when an account is deleted).
DROP POLICY IF EXISTS "media public read" ON storage.objects;
DROP POLICY IF EXISTS "media list own" ON storage.objects;
CREATE POLICY "media list own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificar / verify ────────────────────────────────────────────────────
--   SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_rate_%' OR tgname IN ('trg_post_author','trg_gear_seller');
--   Publicar un anuncio desde la web y comprobar que sale con tu nombre real.
--   La app ya muestra los errores de inserción como "No se pudo publicar…".
-- Opcional (avatars / gear-images): quitar también su listado anónimo. Los nombres
-- de sus políticas SELECT en vivo pueden variar — revísalos con:
--   SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
