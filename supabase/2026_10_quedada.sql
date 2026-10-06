-- ═══════════════════════════════════════════════════════════════════════════
-- La quedada de BandYou (2026-10). Idempotente. Solo AÑADE cosas nuevas: no
-- modifica ni borra nada de lo que ya existe.
--
-- Cada mes tiene su sorteo, en cada provincia (ej.: el sorteo de NOVIEMBRE):
--   · Bolos válidos: de esa provincia y con fecha en noviembre (del 1 al 30).
--   · Inscripción: una cuenta inscribe UNO de sus bolos de la Agenda. Se cierra
--     el 20 de OCTUBRE a las 20:00 (hora de Madrid); justo entonces se abre la
--     de diciembre.
--   · Sorteo automático: el 20 de octubre a las 20:00 la base de datos elige un
--     ganador al azar entre los inscritos de cada provincia. Lo dispara la propia
--     web (la primera visita después de la hora) y, si pg_cron está activado,
--     también una tarea cada 15 minutos. Es idempotente: nunca hay dos ganadores.
--   · El ganador recibe una notificación. Su página tiene "¡Voy!" y comentarios.
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Tipo de notificación nuevo ('quedada') ────────────────────────────────
-- notifications_type_check solo permitía los tipos anteriores.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('message', 'application', 'rsvp', 'review', 'system', 'favorite', 'event_reminder', 'booking', 'quedada')) NOT VALID;

-- ── Fechas del ciclo ───────────────────────────────────────────────────────
-- p_cycle = primer día del mes del sorteo. Se sortea el día 20 del mes ANTERIOR
-- a las 20:00 en Madrid.
CREATE OR REPLACE FUNCTION quedada_draw_at(p_cycle date)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT (((date_trunc('month', p_cycle) - interval '1 month')::date + 19) + time '20:00') AT TIME ZONE 'Europe/Madrid'
$$;

-- Ciclo al que se apunta quien se inscribe AHORA: el del mes que viene hasta
-- su sorteo (día 20), el del siguiente después.
CREATE OR REPLACE FUNCTION quedada_open_cycle()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN now() < quedada_draw_at((date_trunc('month', now() AT TIME ZONE 'Europe/Madrid') + interval '1 month')::date)
      THEN (date_trunc('month', now() AT TIME ZONE 'Europe/Madrid') + interval '1 month')::date
    ELSE (date_trunc('month', now() AT TIME ZONE 'Europe/Madrid') + interval '2 months')::date
  END
$$;

-- ── Inscripciones ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quedada_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle      date NOT NULL,
  province   text NOT NULL,
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle, user_id),
  UNIQUE (cycle, event_id)
);
CREATE INDEX IF NOT EXISTS quedada_entries_cycle_province_idx ON quedada_entries (cycle, province);

-- Ciclo, provincia y autor los fija el servidor: el cliente solo manda event_id.
CREATE OR REPLACE FUNCTION quedada_entry_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para inscribir tu bolo.'; END IF;
  SELECT id, user_id, city, date::date AS day INTO ev FROM events WHERE id = NEW.event_id;
  IF ev.id IS NULL OR ev.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo puedes inscribir tus propios bolos.' USING ERRCODE = 'P0001', HINT = 'quedada';
  END IF;
  IF coalesce(ev.city, '') IN ('', 'Otra') THEN
    RAISE EXCEPTION 'El bolo tiene que tener una provincia.' USING ERRCODE = 'P0001', HINT = 'quedada';
  END IF;
  IF (SELECT p_id FROM owner_profile(auth.uid())) IS NULL THEN
    RAISE EXCEPTION 'Crea tu perfil para inscribir un bolo.' USING ERRCODE = 'P0001', HINT = 'quedada';
  END IF;
  NEW.user_id  := auth.uid();
  NEW.cycle    := quedada_open_cycle();
  NEW.province := ev.city;
  IF ev.day < NEW.cycle OR ev.day >= (NEW.cycle + interval '1 month')::date THEN
    RAISE EXCEPTION 'El bolo tiene que ser del mismo mes del sorteo.' USING ERRCODE = 'P0001', HINT = 'quedada';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_quedada_entry_check ON quedada_entries;
CREATE TRIGGER trg_quedada_entry_check BEFORE INSERT ON quedada_entries
  FOR EACH ROW EXECUTE FUNCTION quedada_entry_check();

ALTER TABLE quedada_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quedada entries read" ON quedada_entries;
CREATE POLICY "quedada entries read" ON quedada_entries FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "quedada entries insert own" ON quedada_entries;
CREATE POLICY "quedada entries insert own" ON quedada_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
-- Retirarse solo antes del sorteo.
DROP POLICY IF EXISTS "quedada entries withdraw own" ON quedada_entries;
CREATE POLICY "quedada entries withdraw own" ON quedada_entries FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND now() < quedada_draw_at(cycle));

-- ── Ganadores ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quedada_winners (
  cycle         date NOT NULL,
  province      text NOT NULL,
  -- SET NULL, not CASCADE: deleting the winning gig must not reopen the draw.
  event_id      uuid REFERENCES events(id) ON DELETE SET NULL,
  entries_count int  NOT NULL DEFAULT 1,
  drawn_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cycle, province)
);
ALTER TABLE quedada_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quedada winners read" ON quedada_winners;
CREATE POLICY "quedada winners read" ON quedada_winners FOR SELECT TO anon, authenticated USING (true);
-- Sin políticas de escritura: solo quedada_run_draws() (SECURITY DEFINER) escribe.

CREATE OR REPLACE FUNCTION quedada_is_winner(p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM quedada_winners WHERE event_id = p_event)
$$;

-- Sorteo: idempotente, seguro de llamar a la vez desde varios sitios.
CREATE OR REPLACE FUNCTION quedada_run_draws()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  picked uuid;
  total int;
  owner uuid;
  drawn int := 0;
BEGIN
  FOR r IN
    SELECT e.cycle, e.province
    FROM quedada_entries e
    WHERE quedada_draw_at(e.cycle) <= now()
      AND e.cycle >= (date_trunc('month', now()) - interval '2 months')::date
      AND NOT EXISTS (SELECT 1 FROM quedada_winners w WHERE w.cycle = e.cycle AND w.province = e.province)
    GROUP BY e.cycle, e.province
  LOOP
    picked := NULL;
    total := 0;
    -- Only entries whose event still exists, is still in the province and still in the window.
    SELECT e.event_id, count(*) OVER () INTO picked, total
    FROM quedada_entries e
    JOIN events ev ON ev.id = e.event_id
    WHERE e.cycle = r.cycle AND e.province = r.province
      AND ev.city = r.province
      AND ev.date::date >= r.cycle
      AND ev.date::date < (r.cycle + interval '1 month')::date
    ORDER BY random()
    LIMIT 1;
    CONTINUE WHEN picked IS NULL;

    INSERT INTO quedada_winners (cycle, province, event_id, entries_count)
    VALUES (r.cycle, r.province, picked, total)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN
      drawn := drawn + 1;
      SELECT user_id INTO owner FROM events WHERE id = picked;
      IF owner IS NOT NULL THEN
        -- A failed notice must never undo the draw.
        BEGIN
          INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
          VALUES (owner, 'quedada', '¡Tu bolo ha ganado la quedada de BandYou!',
                  'Lo promocionamos en la portada de ' || r.province || ' hasta el día del bolo. ¡Anima a la gente a ir!',
                  'event', picked);
        EXCEPTION WHEN others THEN NULL;
        END;
      END IF;
    END IF;
  END LOOP;
  RETURN drawn;
END;
$$;

-- Un bolo ganador no puede cambiar de fecha ni de provincia.
CREATE OR REPLACE FUNCTION quedada_lock_winner_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.date IS DISTINCT FROM OLD.date OR NEW.city IS DISTINCT FROM OLD.city) AND quedada_is_winner(OLD.id) THEN
    RAISE EXCEPTION 'Este bolo ha ganado la quedada: no se puede cambiar la fecha ni la provincia.' USING ERRCODE = 'P0001', HINT = 'quedada';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_quedada_lock_winner_event ON events;
CREATE TRIGGER trg_quedada_lock_winner_event BEFORE UPDATE OF date, city ON events
  FOR EACH ROW EXECUTE FUNCTION quedada_lock_winner_event();

-- ── "¡Voy!" ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quedada_attendees (
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE quedada_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quedada attendees read" ON quedada_attendees;
CREATE POLICY "quedada attendees read" ON quedada_attendees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "quedada attendees join" ON quedada_attendees;
CREATE POLICY "quedada attendees join" ON quedada_attendees FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND quedada_is_winner(event_id));
DROP POLICY IF EXISTS "quedada attendees leave" ON quedada_attendees;
CREATE POLICY "quedada attendees leave" ON quedada_attendees FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Cuántos van (también para visitantes sin sesión).
CREATE OR REPLACE FUNCTION quedada_attendee_count(p_event uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM quedada_attendees WHERE event_id = p_event
$$;

-- Quiénes van: nombre, foto y perfil (solo con sesión).
CREATE OR REPLACE FUNCTION quedada_people(p_event uuid)
RETURNS TABLE (user_id uuid, name text, avatar_url text, profile_type text, profile_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT a.user_id, coalesce(op.p_name, 'Usuario'),
         coalesce(m.avatar_url, b.avatar_url, v.avatar_url, t.avatar_url, rs.avatar_url),
         op.p_type, op.p_id
  FROM quedada_attendees a
  CROSS JOIN LATERAL owner_profile(a.user_id) op
  LEFT JOIN musicians        m  ON op.p_type = 'musician'  AND m.id  = op.p_id
  LEFT JOIN bands            b  ON op.p_type = 'band'      AND b.id  = op.p_id
  LEFT JOIN venues           v  ON op.p_type = 'venue'     AND v.id  = op.p_id
  LEFT JOIN teachers         t  ON op.p_type = 'teacher'   AND t.id  = op.p_id
  LEFT JOIN rehearsal_spaces rs ON op.p_type = 'rehearsal' AND rs.id = op.p_id
  WHERE a.event_id = p_event
  ORDER BY a.created_at
  LIMIT 60;
END;
$$;

-- ── Comentarios ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quedada_comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name         text,
  author_avatar       text,
  author_profile_type text,
  author_profile_id   uuid,
  text                text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 500),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quedada_comments_event_idx ON quedada_comments (event_id, created_at);
CREATE INDEX IF NOT EXISTS quedada_comments_user_created_idx ON quedada_comments (user_id, created_at DESC);

-- Autor fijado por el servidor (nadie comenta con el nombre de otro).
CREATE OR REPLACE FUNCTION quedada_comment_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  op record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para comentar.'; END IF;
  IF NOT quedada_is_winner(NEW.event_id) THEN
    RAISE EXCEPTION 'Solo se puede comentar en el bolo de la quedada.' USING ERRCODE = 'P0001', HINT = 'quedada';
  END IF;
  SELECT * INTO op FROM owner_profile(auth.uid());
  NEW.user_id := auth.uid();
  NEW.text := btrim(NEW.text);
  NEW.author_name := coalesce(nullif(btrim(op.p_name), ''), 'Usuario');
  NEW.author_profile_type := op.p_type;
  NEW.author_profile_id := op.p_id;
  NEW.author_avatar := CASE op.p_type
    WHEN 'musician'  THEN (SELECT avatar_url FROM musicians        WHERE id = op.p_id)
    WHEN 'band'      THEN (SELECT avatar_url FROM bands            WHERE id = op.p_id)
    WHEN 'venue'     THEN (SELECT avatar_url FROM venues           WHERE id = op.p_id)
    WHEN 'teacher'   THEN (SELECT avatar_url FROM teachers         WHERE id = op.p_id)
    WHEN 'rehearsal' THEN (SELECT avatar_url FROM rehearsal_spaces WHERE id = op.p_id)
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_quedada_comment_author ON quedada_comments;
CREATE TRIGGER trg_quedada_comment_author BEFORE INSERT ON quedada_comments
  FOR EACH ROW EXECUTE FUNCTION quedada_comment_author();
-- Antispam: 10 comentarios cada 10 minutos (enforce_rate_limit, del SQL de refuerzo).
DROP TRIGGER IF EXISTS trg_rate_quedada_comments ON quedada_comments;
CREATE TRIGGER trg_rate_quedada_comments BEFORE INSERT ON quedada_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_rate_limit('user_id', '10', '10 minutes');

ALTER TABLE quedada_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quedada comments read" ON quedada_comments;
CREATE POLICY "quedada comments read" ON quedada_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "quedada comments insert own" ON quedada_comments;
CREATE POLICY "quedada comments insert own" ON quedada_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
-- Borra quien lo escribió o la banda dueña del bolo.
DROP POLICY IF EXISTS "quedada comments delete" ON quedada_comments;
CREATE POLICY "quedada comments delete" ON quedada_comments FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid())
         OR EXISTS (SELECT 1 FROM events e WHERE e.id = quedada_comments.event_id AND e.user_id = (SELECT auth.uid())));

-- Cuántos comentarios hay (para visitantes sin sesión: "12 comentarios · entra para leerlos").
CREATE OR REPLACE FUNCTION quedada_comment_count(p_event uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM quedada_comments WHERE event_id = p_event
$$;

-- ── Permisos de las funciones ─────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION quedada_entry_check()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION quedada_comment_author()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION quedada_lock_winner_event() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION quedada_run_draws()            TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION quedada_attendee_count(uuid)   TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION quedada_comment_count(uuid)    TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION quedada_is_winner(uuid)        TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION quedada_people(uuid)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION quedada_people(uuid)           TO authenticated;

COMMIT;

-- ── Tarea programada (opcional) ───────────────────────────────────────────
-- Si pg_cron está activado (Database → Extensions → pg_cron), el sorteo se hace
-- también sin visitas. Si no lo está, este bloque no hace nada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'quedada-draws';
    PERFORM cron.schedule('quedada-draws', '*/15 * * * *', 'SELECT public.quedada_run_draws()');
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ── Verificar ─────────────────────────────────────────────────────────────
--   SELECT quedada_open_cycle(), quedada_draw_at(quedada_open_cycle());
--   SELECT * FROM quedada_entries ORDER BY created_at DESC LIMIT 10;
--   SELECT * FROM quedada_winners ORDER BY drawn_at DESC LIMIT 10;
