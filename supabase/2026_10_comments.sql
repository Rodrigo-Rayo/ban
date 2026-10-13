-- ═══════════════════════════════════════════════════════════════════════════
-- Comentarios en los anuncios de Se busca y en los eventos (2026-10-13). Idempotente.
--
-- Se ven solo al abrir un anuncio o un evento, y solo con sesión iniciada
-- (sin sesión se ve cuántos hay). Igual que los comentarios de La quedada:
--   - El autor (nombre, foto, perfil) lo fija el servidor: nadie comenta con
--     el nombre de otro.
--   - Antispam: 10 comentarios cada 10 minutos por persona.
--   - Hace falta perfil para comentar (como para publicar).
--   - Borra quien lo escribió o el dueño del anuncio / evento.
--   - Aviso al dueño y a quien ya comentó antes (sin avisarse a uno mismo, y
--     uno por hilo mientras no se lea).
-- Si se borra el anuncio o el evento, sus comentarios se borran con él.
--
-- Hasta que se ejecute, la web no enseña nada (CommentsService ve que comment_count no existe).
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             uuid REFERENCES public.posts(id)  ON DELETE CASCADE,
  event_id            uuid REFERENCES public.events(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name         text,
  author_avatar       text,
  author_profile_type text,
  author_profile_id   uuid,
  text                text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 500),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_one_target CHECK (num_nonnulls(post_id, event_id) = 1)
);
CREATE INDEX IF NOT EXISTS comments_post_idx  ON public.comments (post_id, created_at)  WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_event_idx ON public.comments (event_id, created_at) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_user_created_idx ON public.comments (user_id, created_at DESC);

-- ── Autor fijado por el servidor ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.comment_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  op record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para comentar.'; END IF;
  SELECT * INTO op FROM public.owner_profile(auth.uid());
  NEW.user_id := auth.uid();
  NEW.created_at := now();
  NEW.text := btrim(NEW.text);
  NEW.author_name := coalesce(nullif(btrim(op.p_name), ''), 'Usuario');
  NEW.author_profile_type := op.p_type;
  NEW.author_profile_id := op.p_id;
  NEW.author_avatar := CASE op.p_type
    WHEN 'musician'  THEN (SELECT avatar_url FROM public.musicians        WHERE id = op.p_id)
    WHEN 'band'      THEN (SELECT avatar_url FROM public.bands            WHERE id = op.p_id)
    WHEN 'venue'     THEN (SELECT avatar_url FROM public.venues           WHERE id = op.p_id)
    WHEN 'teacher'   THEN (SELECT avatar_url FROM public.teachers         WHERE id = op.p_id)
    WHEN 'rehearsal' THEN (SELECT avatar_url FROM public.rehearsal_spaces WHERE id = op.p_id)
  END;
  RETURN NEW;
END $$;
-- Los triggers BEFORE se ejecutan por orden alfabético: el autor (trg_comment_author)
-- queda fijado antes de contar el límite (trg_rate_comments).
DROP TRIGGER IF EXISTS trg_comment_author ON public.comments;
CREATE TRIGGER trg_comment_author BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comment_author();
DROP TRIGGER IF EXISTS trg_rate_comments ON public.comments;
CREATE TRIGGER trg_rate_comments BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit('user_id', '10', '10 minutes');

-- ── Quién puede leer, escribir y borrar ────────────────────────────────────
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments read" ON public.comments;
CREATE POLICY "comments read" ON public.comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "comments insert own" ON public.comments;
CREATE POLICY "comments insert own" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "require profile to create" ON public.comments;
CREATE POLICY "require profile to create" ON public.comments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_profile((SELECT auth.uid())));
DROP POLICY IF EXISTS "comments delete" ON public.comments;
CREATE POLICY "comments delete" ON public.comments FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid())
         OR EXISTS (SELECT 1 FROM public.posts  p WHERE p.id = comments.post_id  AND p.user_id = (SELECT auth.uid()))
         OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = comments.event_id AND e.user_id = (SELECT auth.uid())));
-- Sin UPDATE: un comentario no se edita (se borra y se escribe otro).
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.comments FROM anon, authenticated;
REVOKE ALL ON public.comments FROM anon;

-- Cuántos hay (para visitantes sin sesión: "3 comentarios · entra para leerlos").
CREATE OR REPLACE FUNCTION public.comment_count(p_post uuid DEFAULT NULL, p_event uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN p_post  IS NOT NULL THEN (SELECT count(*)::int FROM public.comments WHERE post_id  = p_post)
    WHEN p_event IS NOT NULL THEN (SELECT count(*)::int FROM public.comments WHERE event_id = p_event)
    ELSE 0 END
$$;

-- ── Avisos ─────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('message', 'application', 'rsvp', 'review', 'system', 'favorite', 'event_reminder', 'booking', 'quedada', 'post_alert', 'comment')) NOT VALID;

-- Al dueño ("Ana ha comentado en tu anuncio") y a quien ya comentó antes
-- ("Ana también ha comentado en …"), como mucho 10. Una persona no recibe otro
-- aviso del mismo hilo mientras tenga uno sin leer (nada de 10 avisos por 10
-- comentarios seguidos). Nunca bloquea el comentario.
CREATE OR REPLACE FUNCTION public.notify_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_kind  text;
  v_what  text;
  v_id    uuid;
  v_body  text := left(NEW.text, 120);
  v_others uuid[];
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT p.user_id, coalesce(nullif(btrim(p.title), ''), 'tu anuncio') INTO v_owner, v_title
      FROM public.posts p WHERE p.id = NEW.post_id;
    v_kind := 'post'; v_what := 'anuncio'; v_id := NEW.post_id;
    SELECT array_agg(t.user_id) INTO v_others FROM (
      SELECT c.user_id FROM public.comments c
      WHERE c.post_id = NEW.post_id AND c.id <> NEW.id
        AND c.user_id <> NEW.user_id AND c.user_id IS DISTINCT FROM v_owner
      GROUP BY c.user_id ORDER BY max(c.created_at) DESC LIMIT 10) t;
  ELSE
    SELECT e.user_id, coalesce(nullif(btrim(e.title), ''), 'tu evento') INTO v_owner, v_title
      FROM public.events e WHERE e.id = NEW.event_id;
    v_kind := 'event'; v_what := 'evento'; v_id := NEW.event_id;
    SELECT array_agg(t.user_id) INTO v_others FROM (
      SELECT c.user_id FROM public.comments c
      WHERE c.event_id = NEW.event_id AND c.id <> NEW.id
        AND c.user_id <> NEW.user_id AND c.user_id IS DISTINCT FROM v_owner
      GROUP BY c.user_id ORDER BY max(c.created_at) DESC LIMIT 10) t;
  END IF;

  BEGIN
    IF v_owner IS NOT NULL AND v_owner <> NEW.user_id AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_owner AND n.type = 'comment' AND n.entity_id = v_id AND n.read IS NOT TRUE
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
      VALUES (v_owner, 'comment',
              left(NEW.author_name || ' ha comentado en tu ' || v_what || ' «' || v_title || '»', 120),
              v_body, v_kind, v_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_comment (owner) failed: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    SELECT u, 'comment',
           left(NEW.author_name || ' también ha comentado en «' || v_title || '»', 120),
           v_body, v_kind, v_id
    FROM unnest(coalesce(v_others, '{}'::uuid[])) AS u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = u AND n.type = 'comment' AND n.entity_id = v_id AND n.read IS NOT TRUE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_comment (thread) failed: %', SQLERRM;
  END;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_comment failed: %', SQLERRM;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_comment ON public.comments;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment();

-- ── Permisos de las funciones ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.comment_author()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_comment()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comment_count(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.comment_count(uuid, uuid) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar (1 tabla, 3 triggers, 4 políticas):
--   SELECT to_regclass('public.comments');
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.comments'::regclass AND NOT tgisinternal ORDER BY 1;
--   SELECT policyname FROM pg_policies WHERE tablename = 'comments' ORDER BY 1;
