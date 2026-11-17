-- ═══════════════════════════════════════════════════════════════════════════
-- La pregunta del mes (2026-11-17). Idempotente: se puede ejecutar más de una vez.
--
-- Una pregunta abierta cada mes; cada persona con perfil contesta una vez
-- (puede editar o borrar su respuesta mientras la pregunta está abierta).
--   - Las preguntas y respuestas se ven sin sesión (la página es pública y sale en Google).
--   - Una pregunta futura no se ve hasta su fecha de apertura.
--   - El autor (nombre, foto, perfil, instrumento, ciudad) lo fija el servidor.
--   - Hace falta perfil para contestar (como para publicar).
--   - Al cerrar, las respuestas quedan en el archivo y ya no se pueden editar (sí borrar).
--
-- Ya van programadas seis preguntas (una al mes hasta mayo). Para añadir otra:
--   INSERT INTO public.questions (slug, title, intro, starters, opens_at, closes_at)
--   VALUES ('mi-pregunta', '¿…?', 'Contexto corto', ARRAY['Empieza así…'], '2027-05-15', '2027-06-15');
-- Para quitar una respuesta fuera de lugar: Table Editor → question_answers → borrar la fila.
--
-- Hasta que se ejecute, la web no enseña la sección (QuestionsService ve que la tabla no existe).
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Preguntas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  title      text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 5 AND 120),
  intro      text CHECK (intro IS NULL OR char_length(intro) <= 300),
  -- Comienzos de frase que se ofrecen para arrancar a escribir.
  starters   text[] NOT NULL DEFAULT '{}' CHECK (cardinality(starters) <= 6),
  opens_at   timestamptz NOT NULL,
  closes_at  timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT questions_dates CHECK (closes_at > opens_at)
);
CREATE INDEX IF NOT EXISTS questions_opens_idx ON public.questions (opens_at DESC);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "questions read opened" ON public.questions;
CREATE POLICY "questions read opened" ON public.questions FOR SELECT TO anon, authenticated
  USING (opens_at <= now());
-- Solo se crean desde el SQL Editor.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.questions FROM anon, authenticated;
GRANT SELECT ON public.questions TO anon, authenticated;

-- ── Respuestas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.question_answers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id         uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  text                text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 280),
  author_name         text,
  author_avatar       text,
  author_profile_type text,
  author_profile_id   uuid,
  -- "Guitarra", "Banda", "Profe"… y su provincia o región, para firmar la respuesta.
  author_role         text,
  author_city         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_answers_one_each UNIQUE (question_id, user_id)
);
CREATE INDEX IF NOT EXISTS question_answers_list_idx ON public.question_answers (question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS question_answers_user_idx ON public.question_answers (user_id);

-- Autor fijado por el servidor y pregunta abierta, al escribir y al editar.
CREATE OR REPLACE FUNCTION public.question_answer_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  op record;
  q  record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para responder.'; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.question_id := OLD.question_id;
    NEW.user_id     := OLD.user_id;
    NEW.created_at  := OLD.created_at;
  ELSE
    NEW.user_id    := auth.uid();
    NEW.created_at := now();
  END IF;
  SELECT opens_at, closes_at INTO q FROM public.questions WHERE id = NEW.question_id;
  IF q.opens_at IS NULL OR now() < q.opens_at OR now() >= q.closes_at THEN
    RAISE EXCEPTION 'Esta pregunta ya está cerrada.' USING HINT = 'closed';
  END IF;

  SELECT * INTO op FROM public.owner_profile(NEW.user_id);
  NEW.text := btrim(NEW.text);
  NEW.updated_at := now();
  NEW.author_name := coalesce(nullif(btrim(op.p_name), ''), 'Usuario');
  NEW.author_profile_type := op.p_type;
  NEW.author_profile_id := op.p_id;
  CASE op.p_type
    WHEN 'musician' THEN
      SELECT avatar_url, nullif(btrim(split_part(instrument, ',', 1)), ''), city
        INTO NEW.author_avatar, NEW.author_role, NEW.author_city FROM public.musicians WHERE id = op.p_id;
    WHEN 'band' THEN
      SELECT avatar_url, 'Banda', city INTO NEW.author_avatar, NEW.author_role, NEW.author_city FROM public.bands WHERE id = op.p_id;
    WHEN 'teacher' THEN
      SELECT avatar_url, 'Profe', city INTO NEW.author_avatar, NEW.author_role, NEW.author_city FROM public.teachers WHERE id = op.p_id;
    WHEN 'rehearsal' THEN
      SELECT avatar_url, 'Local de ensayo', city INTO NEW.author_avatar, NEW.author_role, NEW.author_city FROM public.rehearsal_spaces WHERE id = op.p_id;
    WHEN 'venue' THEN
      SELECT avatar_url, 'Sala', city INTO NEW.author_avatar, NEW.author_role, NEW.author_city FROM public.venues WHERE id = op.p_id;
    ELSE
      NEW.author_avatar := NULL; NEW.author_role := NULL; NEW.author_city := NULL;
  END CASE;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_question_answer_author ON public.question_answers;
CREATE TRIGGER trg_question_answer_author BEFORE INSERT OR UPDATE ON public.question_answers
  FOR EACH ROW EXECUTE FUNCTION public.question_answer_author();

-- Borrar la propia respuesta se puede siempre (también de preguntas cerradas):
-- es contenido de cada uno, y borrar la cuenta tiene que poder llevarse sus respuestas.
DROP TRIGGER IF EXISTS trg_question_answer_guard_delete ON public.question_answers;
DROP FUNCTION IF EXISTS public.question_answer_guard_delete();

ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "answers read" ON public.question_answers;
CREATE POLICY "answers read" ON public.question_answers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "answers insert own" ON public.question_answers;
CREATE POLICY "answers insert own" ON public.question_answers FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "require profile to create" ON public.question_answers;
CREATE POLICY "require profile to create" ON public.question_answers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_profile((SELECT auth.uid())));
DROP POLICY IF EXISTS "answers update own" ON public.question_answers;
CREATE POLICY "answers update own" ON public.question_answers FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "answers delete own" ON public.question_answers;
CREATE POLICY "answers delete own" ON public.question_answers FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.question_answers FROM anon;
GRANT SELECT ON public.question_answers TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.question_answers FROM authenticated;
-- Al editar solo cambia el texto (el resto lo fija el trigger).
REVOKE UPDATE ON public.question_answers FROM authenticated;
GRANT  UPDATE (text) ON public.question_answers TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.question_answers TO authenticated;

REVOKE ALL ON FUNCTION public.question_answer_author()       FROM PUBLIC, anon, authenticated;

-- ── Las seis primeras preguntas ────────────────────────────────────────────
INSERT INTO public.questions (slug, title, intro, starters, opens_at, closes_at) VALUES
  ('peor-bolo', '¿Cuál ha sido el peor bolo de tu vida?',
   'Ese concierto que hoy cuentas entre risas (o todavía no). Sin nombres de salas ni de personas.',
   ARRAY['Llegamos a la sala y…', 'El técnico de sonido…', 'Vinieron cuatro personas y…', 'Lo peor fue cuando…'],
   '2026-11-17 00:00+01', '2026-12-15 00:00+01'),
  ('disco-que-te-hizo-tocar', '¿Qué disco te hizo querer tocar?',
   'El que escuchaste una y otra vez hasta que tuviste que coger un instrumento.',
   ARRAY['Lo escuché por primera vez…', 'Me lo pasó…', 'Tenía 14 años y…', 'Fue culpa de…'],
   '2026-12-15 00:00+01', '2027-01-15 00:00+01'),
  ('nunca-mas-sala', '¿Qué no volverías a aceptar para tocar?',
   'Pagar por tocar, tocar gratis «por la visibilidad», sin prueba de sonido… Cuéntalo para que otros no caigan.',
   ARRAY['Nunca más…', 'Nos pidieron…', 'Aprendimos que…'],
   '2027-01-15 00:00+01', '2027-02-15 00:00+01'),
  ('como-conociste-a-tu-banda', '¿Cómo conociste a tu banda?',
   'Un anuncio, un amigo de un amigo, una jam a las tantas…',
   ARRAY['Todo empezó en…', 'Vi un anuncio que…', 'Éramos amigos de…'],
   '2027-02-15 00:00+01', '2027-03-15 00:00+01'),
  ('cancion-que-no-vuelves-a-tocar', '¿Qué canción te niegas a volver a tocar?',
   'La que te han pedido mil veces, la que te sale de memoria y ya no aguantas.',
   ARRAY['No puedo más con…', 'En cada boda…', 'La toqué tantas veces que…'],
   '2027-03-15 00:00+01', '2027-04-15 00:00+01'),
  ('primer-instrumento', '¿Cuál fue tu primer instrumento y qué fue de él?',
   'El de segunda mano, el regalo de Reyes, el que aún guardas en el altillo.',
   ARRAY['Me lo regalaron…', 'Costó…', 'Todavía lo tengo…', 'Lo vendí para…'],
   '2027-04-15 00:00+02', '2027-05-15 00:00+02')
ON CONFLICT (slug) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar (2 tablas, 1 trigger, 5 políticas en respuestas, 6 preguntas):
--   SELECT to_regclass('public.questions'), to_regclass('public.question_answers');
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.question_answers'::regclass AND NOT tgisinternal ORDER BY 1;
--   SELECT policyname FROM pg_policies WHERE tablename = 'question_answers' ORDER BY 1;
--   SELECT slug, opens_at, closes_at FROM public.questions ORDER BY opens_at;
