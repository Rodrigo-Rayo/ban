-- ═══════════════════════════════════════════════════════════════════════════
-- Salvabolos, Cartel compartido y Reto del mes (2026-10). Idempotente.
--
-- 1. Salvabolos: un "Buscamos músico" para un bolo de los próximos 7 días se
--    puede marcar como urgente (posts.urgent). Al publicarlo se avisa al momento
--    a los músicos de ese instrumento en esa provincia (máx. 150, aviso dentro de
--    la web). Máximo 2 anuncios urgentes por cuenta cada 7 días (aunque se borren).
--    Cuando llega el día del bolo, quien publicó puede decir quién se lo salvó
--    (mark_gig_saved): esa persona suma una medalla "Salvabolos" en su perfil
--    (tabla gig_saves). Tiene que haberle escrito antes; máx. 3 medallas al mes.
-- 2. Cartel compartido: anuncio nuevo (type 'shared_bill') para buscar bandas con
--    las que compartir una fecha. Lleva fecha (obligatoria) y sala (posts.venue).
-- 3. Reto del mes: challenges (los crea el dueño a mano, ver el final),
--    challenge_entries (un enlace por cuenta y reto) y challenge_votes (un voto
--    por cuenta y reto, con perfil; se puede cambiar). Votar y retirar el voto
--    van por challenge_vote() / challenge_unvote().
--
-- Solo añade cosas: no cambia ni borra nada de lo que hay. La web lo activa sola.
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1/2 · columnas y tipos de anuncio ──────────────────────────────────────
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS venue  text;

-- El CHECK original del tipo (inline en migrations.sql) no conoce 'shared_bill'.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.posts'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) LIKE '%musician_seeking_band%'
  LOOP
    EXECUTE format('ALTER TABLE public.posts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.posts ADD CONSTRAINT posts_type_check CHECK (type IN (
  'musician_seeking_band', 'band_seeking_musician', 'event_announcement', 'session_offer',
  'gear_sale', 'looking_for_rehearsal', 'collab', 'other', 'shared_bill')) NOT VALID;

-- La fecha vale ahora también para el cartel compartido (y es obligatoria en él).
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_gig_date_check;
ALTER TABLE public.posts ADD  CONSTRAINT posts_gig_date_check
  CHECK (gig_date IS NULL OR (type IN ('band_seeking_musician', 'shared_bill')
         AND gig_date BETWEEN (created_at AT TIME ZONE 'Europe/Madrid')::date - 1  -- Canarias / fuera de España
                          AND (created_at AT TIME ZONE 'Europe/Madrid')::date + 60)) NOT VALID;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_shared_bill_check;
ALTER TABLE public.posts ADD  CONSTRAINT posts_shared_bill_check
  CHECK (type <> 'shared_bill' OR gig_date IS NOT NULL) NOT VALID;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_venue_check;
ALTER TABLE public.posts ADD  CONSTRAINT posts_venue_check
  CHECK (venue IS NULL OR char_length(venue) <= 80) NOT VALID;
-- Urgente = buscamos un instrumento concreto para un bolo de los próximos 7 días.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_urgent_check;
ALTER TABLE public.posts ADD  CONSTRAINT posts_urgent_check
  CHECK (NOT urgent OR (type = 'band_seeking_musician' AND gig_date IS NOT NULL
         AND coalesce(btrim(instrument), '') <> ''
         AND gig_date <= (created_at AT TIME ZONE 'Europe/Madrid')::date + 7)) NOT VALID;

-- Máximo 2 urgentes por cuenta cada 7 días (los avisos llegan a mucha gente). Se
-- cuentan en un registro aparte para que borrar el anuncio no devuelva el cupo.
CREATE TABLE IF NOT EXISTS public.urgent_post_log (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS urgent_post_log_user_idx ON public.urgent_post_log (user_id, created_at DESC);
ALTER TABLE public.urgent_post_log ENABLE ROW LEVEL SECURITY;  -- sin políticas: solo el trigger
REVOKE ALL ON public.urgent_post_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.posts_urgent_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- La fecha de publicación la pone el servidor: las comprobaciones de fechas dependen de ella.
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  IF NOT NEW.urgent THEN RETURN NEW; END IF;
  -- "Urgente" solo al publicar (al editar no se avisa a nadie).
  IF TG_OP = 'UPDATE' AND NOT coalesce(OLD.urgent, false) THEN
    RAISE EXCEPTION 'Un anuncio solo puede ser urgente al publicarlo' USING ERRCODE = 'P0001', HINT = 'rate_limit';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.urgent_post_log
        WHERE user_id = NEW.user_id AND created_at > now() - interval '7 days') >= 2 THEN
      RAISE EXCEPTION 'Máximo 2 anuncios urgentes por semana' USING ERRCODE = 'P0001', HINT = 'rate_limit';
    END IF;
    INSERT INTO public.urgent_post_log (user_id) VALUES (NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_posts_urgent_limit ON public.posts;
CREATE TRIGGER trg_posts_urgent_limit BEFORE INSERT OR UPDATE OF urgent ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_urgent_limit();
REVOKE EXECUTE ON FUNCTION public.posts_urgent_limit() FROM PUBLIC, anon, authenticated;

-- Las alertas de Se busca también avisan de los carteles compartidos.
CREATE OR REPLACE FUNCTION public.notify_post_alerts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_title text;
BEGIN
  IF NEW.type NOT IN ('musician_seeking_band', 'band_seeking_musician', 'looking_for_rehearsal', 'collab', 'session_offer', 'other', 'shared_bill') THEN
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

-- Salvabolos: aviso inmediato a los músicos de ese instrumento en esa provincia.
-- Corre después de las alertas (orden alfabético de triggers) y no repite a quien
-- ya recibió aviso por una alerta. Nunca bloquea la publicación.
CREATE OR REPLACE FUNCTION public.notify_salvabolos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT NEW.urgent THEN RETURN NEW; END IF;
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    SELECT m.user_id, 'post_alert',
           left('Salvabolos: buscan ' || lower(btrim(NEW.instrument)) || ' para el '
                || to_char(NEW.gig_date, 'DD/MM') || ' en ' || coalesce(NEW.city, 'tu provincia'), 120),
           left(concat_ws(' · ', nullif(NEW.author_name, ''), nullif(btrim(NEW.title), '')), 160),
           'post', NEW.id
    FROM (
      SELECT DISTINCT ON (mu.user_id) mu.user_id
      FROM public.musicians mu
      WHERE mu.user_id <> NEW.user_id
        AND lower(mu.city) = lower(coalesce(NEW.city, ''))
        -- instrument se guarda como 'Guitarra, Bajo': coincidencia literal (sin comodines de LIKE)
        AND position(', ' || lower(btrim(NEW.instrument)) || ',' IN ', ' || lower(coalesce(mu.instrument, '')) || ',') > 0
        AND NOT EXISTS (SELECT 1 FROM public.notifications n
                        WHERE n.user_id = mu.user_id AND n.entity_type = 'post' AND n.entity_id = NEW.id)
      LIMIT 150
    ) m;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_salvabolos failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_salvabolos ON public.posts;
CREATE TRIGGER trg_notify_salvabolos AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_salvabolos();
REVOKE EXECUTE ON FUNCTION public.notify_salvabolos() FROM PUBLIC, anon, authenticated;

-- Medallas Salvabolos: una por anuncio, la da quien lo publicó.
CREATE TABLE IF NOT EXISTS public.gig_saves (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        uuid UNIQUE REFERENCES public.posts(id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saver_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saver_name     text,
  gig_date       date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (author_user_id <> saver_user_id)
);
CREATE INDEX IF NOT EXISTS gig_saves_saver_idx ON public.gig_saves (saver_user_id);
CREATE INDEX IF NOT EXISTS gig_saves_author_idx ON public.gig_saves (author_user_id, created_at DESC);
ALTER TABLE public.gig_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gig_saves readable" ON public.gig_saves;
CREATE POLICY "gig_saves readable" ON public.gig_saves FOR SELECT USING (true);
-- Sin políticas de escritura: solo a través de mark_gig_saved().
REVOKE ALL ON public.gig_saves FROM anon, authenticated;
GRANT SELECT ON public.gig_saves TO anon, authenticated;

-- El autor de un anuncio con fecha dice quién le salvó el bolo. Tiene que ser
-- alguien con quien haya hablado por mensajes y que tenga perfil de músico.
CREATE OR REPLACE FUNCTION public.mark_gig_saved(p_post_id uuid, p_saver uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_post  public.posts%ROWTYPE;
  v_me    uuid := auth.uid();
  v_name  text;
BEGIN
  SELECT * INTO v_post FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND OR v_post.user_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Solo quien publicó el anuncio puede hacerlo' USING ERRCODE = 'P0001';
  END IF;
  IF v_post.gig_date IS NULL OR v_post.type <> 'band_seeking_musician' THEN
    RAISE EXCEPTION 'El anuncio no es para un bolo con fecha' USING ERRCODE = 'P0001';
  END IF;
  IF p_saver = v_me THEN
    RAISE EXCEPTION 'No puedes darte la medalla a ti' USING ERRCODE = 'P0001';
  END IF;
  IF v_post.gig_date > (now() AT TIME ZONE 'Europe/Madrid')::date THEN
    RAISE EXCEPTION 'Podrás darla el día del bolo' USING ERRCODE = 'P0001';
  END IF;
  IF v_post.created_at > now() - interval '1 day' THEN
    RAISE EXCEPTION 'Podrás darla pasado un día desde que publicaste el anuncio' USING ERRCODE = 'P0001';
  END IF;
  -- Esa persona te escribió (una conversación vacía no cuenta).
  IF NOT EXISTS (SELECT 1 FROM public.conversations c
                 JOIN public.messages m ON m.conversation_id = c.id AND m.sender_id = p_saver
                 WHERE (c.user1_id = v_me AND c.user2_id = p_saver) OR (c.user1_id = p_saver AND c.user2_id = v_me)) THEN
    RAISE EXCEPTION 'Tiene que ser alguien que te haya escrito' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gig_saves WHERE author_user_id = v_me AND saver_user_id = p_saver) THEN
    RAISE EXCEPTION 'Ya le diste una medalla a esa persona' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.gig_saves WHERE author_user_id = v_me AND created_at > now() - interval '30 days') >= 3 THEN
    RAISE EXCEPTION 'Máximo 3 medallas al mes' USING ERRCODE = 'P0001';
  END IF;
  SELECT name INTO v_name FROM public.musicians WHERE user_id = p_saver LIMIT 1;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Esa persona no tiene perfil de músico' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gig_saves (post_id, author_user_id, saver_user_id, saver_name, gig_date)
  VALUES (p_post_id, v_me, p_saver, v_name, v_post.gig_date);
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES (p_saver, 'system', '¡Eres Salvabolos!',
            left(coalesce(v_post.author_name, 'Una banda') || ' dice que le salvaste el bolo. La medalla ya sale en tu perfil.', 160),
            'post', p_post_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'mark_gig_saved notify failed: %', SQLERRM;
  END;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Ese bolo ya tiene su Salvabolos' USING ERRCODE = 'P0001';
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_gig_saved(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_gig_saved(uuid, uuid) TO authenticated;

-- ── 3 · Reto del mes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text NOT NULL UNIQUE,
  title          text NOT NULL CHECK (char_length(title) <= 80),
  brief          text NOT NULL CHECK (char_length(brief) <= 1000),
  reference_url  text CHECK (reference_url IS NULL OR reference_url ~ '^https://'),
  entries_until  timestamptz NOT NULL,
  votes_until    timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (votes_until > entries_until)
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenges readable" ON public.challenges;
CREATE POLICY "challenges readable" ON public.challenges FOR SELECT USING (true);
REVOKE ALL ON public.challenges FROM anon, authenticated;
GRANT SELECT ON public.challenges TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.challenge_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id        uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url                 text NOT NULL CHECK (char_length(url) <= 300 AND url ~ '^https://'),
  caption             text CHECK (caption IS NULL OR char_length(caption) <= 140),
  author_name         text,
  author_profile_type text,
  author_profile_id   uuid,
  votes               integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS challenge_entries_challenge_idx ON public.challenge_entries (challenge_id, votes DESC);
ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entries readable" ON public.challenge_entries;
CREATE POLICY "entries readable" ON public.challenge_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "entries insert own while open" ON public.challenge_entries;
CREATE POLICY "entries insert own while open" ON public.challenge_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.has_profile((SELECT auth.uid()))
              AND EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND now() < c.entries_until));
DROP POLICY IF EXISTS "entries delete own while open" ON public.challenge_entries;
CREATE POLICY "entries delete own while open" ON public.challenge_entries FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid())
         AND EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND now() < c.entries_until));
REVOKE ALL ON public.challenge_entries FROM anon, authenticated;
GRANT SELECT ON public.challenge_entries TO anon, authenticated;
GRANT INSERT, DELETE ON public.challenge_entries TO authenticated;

-- El recuento lo lleva la base de datos: el cliente nunca escribe "votes".
-- Y el nombre y el enlace al perfil salen del perfil de la propia cuenta.
CREATE OR REPLACE FUNCTION public.challenge_entries_defaults() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p record;
BEGIN
  NEW.votes := 0;
  NEW.created_at := now();
  NEW.author_name := NULL; NEW.author_profile_type := NULL; NEW.author_profile_id := NULL;
  SELECT x.id, x.name, x.kind INTO p FROM (
    SELECT id, name, 'musician'  AS kind, 1 AS ord FROM public.musicians        WHERE user_id = NEW.user_id
    UNION ALL SELECT id, name, 'band',      2 FROM public.bands            WHERE user_id = NEW.user_id
    UNION ALL SELECT id, name, 'venue',     3 FROM public.venues           WHERE user_id = NEW.user_id
    UNION ALL SELECT id, name, 'teacher',   4 FROM public.teachers         WHERE user_id = NEW.user_id
    UNION ALL SELECT id, name, 'rehearsal', 5 FROM public.rehearsal_spaces WHERE user_id = NEW.user_id
  ) x ORDER BY x.ord LIMIT 1;
  IF FOUND THEN
    NEW.author_name := p.name; NEW.author_profile_type := p.kind; NEW.author_profile_id := p.id;
  ELSE
    SELECT nullif(btrim(name), '') INTO NEW.author_name FROM public.profiles WHERE id = NEW.user_id;  -- oyentes (sin ficha pública)
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.challenge_entries_defaults() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_challenge_entries_defaults ON public.challenge_entries;
CREATE TRIGGER trg_challenge_entries_defaults BEFORE INSERT ON public.challenge_entries
  FOR EACH ROW EXECUTE FUNCTION public.challenge_entries_defaults();

CREATE TABLE IF NOT EXISTS public.challenge_votes (
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id     uuid NOT NULL REFERENCES public.challenge_entries(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS challenge_votes_entry_idx ON public.challenge_votes (entry_id);
ALTER TABLE public.challenge_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "votes own readable" ON public.challenge_votes;
CREATE POLICY "votes own readable" ON public.challenge_votes FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
-- Sin políticas de escritura: se vota con challenge_vote() y se retira con challenge_unvote().
REVOKE ALL ON public.challenge_votes FROM anon, authenticated;
GRANT SELECT ON public.challenge_votes TO authenticated;

-- Vota a una participación; si ya habías votado en ese reto, el voto se cambia (todo o nada).
CREATE OR REPLACE FUNCTION public.challenge_vote(p_entry_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_me    uuid := auth.uid();
  v_entry public.challenge_entries%ROWTYPE;
BEGIN
  IF NOT public.has_profile(v_me) THEN
    RAISE EXCEPTION 'Crea tu perfil para votar' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_entry FROM public.challenge_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa participación ya no está' USING ERRCODE = 'P0001'; END IF;
  IF v_entry.user_id = v_me THEN RAISE EXCEPTION 'No puedes votarte a ti' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = v_entry.challenge_id AND now() < c.votes_until) THEN
    RAISE EXCEPTION 'La votación está cerrada' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.challenge_votes WHERE challenge_id = v_entry.challenge_id AND user_id = v_me;
  INSERT INTO public.challenge_votes (challenge_id, user_id, entry_id) VALUES (v_entry.challenge_id, v_me, p_entry_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.challenge_vote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_vote(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.challenge_unvote(p_challenge_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = p_challenge_id AND now() < c.votes_until) THEN
    RAISE EXCEPTION 'La votación está cerrada' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.challenge_votes WHERE challenge_id = p_challenge_id AND user_id = auth.uid();
END $$;
REVOKE EXECUTE ON FUNCTION public.challenge_unvote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_unvote(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.challenge_votes_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.challenge_entries SET votes = votes + 1 WHERE id = NEW.entry_id;
    RETURN NEW;
  END IF;
  UPDATE public.challenge_entries SET votes = greatest(0, votes - 1) WHERE id = OLD.entry_id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_challenge_votes_count ON public.challenge_votes;
CREATE TRIGGER trg_challenge_votes_count AFTER INSERT OR DELETE ON public.challenge_votes
  FOR EACH ROW EXECUTE FUNCTION public.challenge_votes_count();
REVOKE EXECUTE ON FUNCTION public.challenge_votes_count() FROM PUBLIC, anon, authenticated;

-- Primer reto (de prueba; cámbialo cuando quieras).
INSERT INTO public.challenges (slug, title, brief, reference_url, entries_until, votes_until)
VALUES (
  '2026-11-clasico-espanol',
  'Tu versión de un clásico del rock español',
  'Elige un clásico del rock o el pop español y hazlo tuyo: solo, con tu banda, en acústico o como quieras. Súbelo a tu YouTube, Instagram, TikTok o SoundCloud y pega aquí el enlace. Máximo un minuto y medio. Gana el que más votos tenga al cierre.',
  NULL,
  timestamp '2026-11-15 20:00' AT TIME ZONE 'Europe/Madrid',
  timestamp '2026-11-22 20:00' AT TIME ZONE 'Europe/Madrid'
) ON CONFLICT (slug) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar:
--   SELECT urgent, venue FROM posts LIMIT 1;
--   SELECT * FROM challenges;
-- Nuevo reto (cada mes):
--   INSERT INTO challenges (slug, title, brief, entries_until, votes_until) VALUES
--   ('2026-12-…', 'Título', 'Explicación', timestamp '2026-12-15 20:00' AT TIME ZONE 'Europe/Madrid',
--    timestamp '2026-12-22 20:00' AT TIME ZONE 'Europe/Madrid');
