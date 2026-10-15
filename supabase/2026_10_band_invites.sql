-- ═══════════════════════════════════════════════════════════════════════════
-- Invitar a los integrantes de una banda (2026-10-15). Idempotente.
--
-- La banda sigue pudiendo poner solo el nombre de cada integrante. Además, junto
-- a cada uno puede pulsar «Invitar»: se crea un enlace personal
-- (bandyou.es/unirse/<token>) que manda por WhatsApp. Quien lo abre se crea su
-- perfil de músico (o entra con el que ya tiene) y acepta: desde ese momento
-- ese integrante queda unido a su perfil (foto y enlace en la banda, «Toca en»
-- en su perfil) y la banda recibe un aviso.
--
--   - Nadie queda unido a una banda sin aceptar él mismo: la banda no puede
--     escribir band_members.user_id (permisos por columna); solo la función de
--     aceptar lo hace, y solo para quien abre el enlace.
--   - Enlace imposible de adivinar (~244 bits aleatorios), de un solo uso, caduca a los 14 días.
--   - Hace falta perfil de músico para aceptar.
--   - El integrante puede salirse (leave_band); la banda puede quitarle (borrar la fila).
--   - Antispam: 30 invitaciones al día por cuenta.
--
-- Hasta que se ejecute, la web no enseña nada nuevo (MediaFeaturesService ve
-- que band_members.user_id no existe).
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── El integrante, unido a su cuenta ───────────────────────────────────────
ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS band_members_band_user_uniq
  ON public.band_members (band_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS band_members_user_idx
  ON public.band_members (user_id) WHERE user_id IS NOT NULL;

-- La banda escribe nombre e instrumento; user_id solo lo ponen las funciones de abajo.
-- OJO: permisos por columna. Una columna nueva en band_members necesita su propio
-- GRANT INSERT/UPDATE (col), y la web no puede usar upsert en esta tabla.
REVOKE INSERT, UPDATE ON public.band_members FROM anon, authenticated;
GRANT INSERT (band_id, name, instrument) ON public.band_members TO authenticated;
GRANT UPDATE (name, instrument)          ON public.band_members TO authenticated;

-- ── Invitaciones ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.band_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE,
  band_id     uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES public.band_members(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS band_invites_member_idx ON public.band_invites (member_id);
DROP INDEX IF EXISTS public.band_invites_band_created_idx;
CREATE INDEX IF NOT EXISTS band_invites_creator_created_idx ON public.band_invites (created_by, created_at DESC);

-- Nadie la lee ni la escribe directamente: todo pasa por las funciones.
ALTER TABLE public.band_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_invites FROM anon, authenticated;

-- ── Crear (o reutilizar) la invitación de un integrante ───────────────────
-- Devuelve el token. Una invitación vigente y sin usar se reutiliza: pulsar
-- «Invitar» dos veces manda el mismo enlace.
CREATE OR REPLACE FUNCTION public.create_band_invite(p_member uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_band  uuid;
  v_linked uuid;
  v_token text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT m.band_id, m.user_id INTO v_band, v_linked
    FROM public.band_members m JOIN public.bands b ON b.id = m.band_id
   WHERE m.id = p_member AND b.user_id = v_uid;
  IF v_band IS NULL THEN RAISE EXCEPTION 'not_your_band'; END IF;
  IF v_linked IS NOT NULL THEN RAISE EXCEPTION 'already_linked'; END IF;

  SELECT i.token INTO v_token FROM public.band_invites i
   WHERE i.member_id = p_member AND i.accepted_at IS NULL AND i.expires_at > now() + interval '1 day'
   ORDER BY i.created_at DESC LIMIT 1;
  IF v_token IS NOT NULL THEN RETURN v_token; END IF;

  IF (SELECT count(*) FROM public.band_invites i
       WHERE i.created_by = v_uid AND i.created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'too_many_invites';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.band_invites (token, band_id, member_id, created_by)
  VALUES (v_token, v_band, p_member, v_uid);
  RETURN v_token;
END $$;

-- ── Qué dice una invitación (también sin sesión, para la página del enlace) ─
-- status: ok | expired | used | invalid. Sin datos privados: lo que ya enseña
-- la ficha pública de la banda.
CREATE OR REPLACE FUNCTION public.band_invite_info(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r record;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  SELECT i.expires_at, i.accepted_at, b.id AS band_id, b.name AS band_name,
         b.avatar_url AS band_avatar, b.city AS band_city, b.genre AS band_genre,
         m.name AS member_name, m.instrument
    INTO r
    FROM public.band_invites i
    JOIN public.bands b ON b.id = i.band_id
    JOIN public.band_members m ON m.id = i.member_id
   WHERE i.token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid'); END IF;
  RETURN jsonb_build_object(
    'status', CASE WHEN r.accepted_at IS NOT NULL THEN 'used'
                   WHEN r.expires_at <= now() THEN 'expired' ELSE 'ok' END,
    'band_id', r.band_id, 'band_name', r.band_name, 'band_avatar', r.band_avatar,
    'band_city', r.band_city, 'band_genre', r.band_genre,
    'member_name', r.member_name, 'instrument', r.instrument);
END $$;

-- ── Aceptar: une al integrante con la cuenta de quien abre el enlace ──────
CREATE OR REPLACE FUNCTION public.accept_band_invite(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_inv    record;
  v_owner  uuid;
  v_band_name text;
  v_name   text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid'; END IF;

  SELECT i.id, i.band_id, i.member_id, i.expires_at, i.accepted_at INTO v_inv
    FROM public.band_invites i WHERE i.token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid'; END IF;
  IF v_inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'used'; END IF;
  IF v_inv.expires_at <= now() THEN RAISE EXCEPTION 'expired'; END IF;

  SELECT b.user_id, b.name INTO v_owner, v_band_name FROM public.bands b WHERE b.id = v_inv.band_id;
  IF v_owner = v_uid THEN RAISE EXCEPTION 'own_band'; END IF;

  SELECT mu.name INTO v_name FROM public.musicians mu WHERE mu.user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'need_musician'; END IF;

  IF EXISTS (SELECT 1 FROM public.band_members m WHERE m.band_id = v_inv.band_id AND m.user_id = v_uid) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  BEGIN
    UPDATE public.band_members SET user_id = v_uid
     WHERE id = v_inv.member_id AND user_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'used'; END IF;
  EXCEPTION WHEN unique_violation THEN
    -- Two invites of the same band accepted at once by the same person.
    RAISE EXCEPTION 'already_member';
  END;

  UPDATE public.band_invites SET accepted_by = v_uid, accepted_at = now() WHERE id = v_inv.id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES (v_owner, 'band_join',
            left(coalesce(nullif(btrim(v_name), ''), 'Un integrante') || ' se ha unido a ' || coalesce(v_band_name, 'tu banda') || ' en BandYou', 120),
            'Ya aparece en la formación con su perfil de músico.', 'band', v_inv.band_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accept_band_invite (notify) failed: %', SQLERRM;
  END;

  RETURN v_inv.band_id;
END $$;

-- ── Salirse de una banda (el integrante) ───────────────────────────────────
-- Su nombre se queda en la formación, sin unir a su perfil; la banda lo quita si quiere.
CREATE OR REPLACE FUNCTION public.leave_band(p_band uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  UPDATE public.band_members SET user_id = NULL
   WHERE band_id = p_band AND user_id = auth.uid();
END $$;

-- ── Avisos: nuevo tipo 'band_join' ─────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('message', 'application', 'rsvp', 'review', 'system', 'favorite', 'event_reminder', 'booking', 'quedada', 'post_alert', 'comment', 'band_join')) NOT VALID;

-- ── Permisos de las funciones ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_band_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.band_invite_info(text)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_band_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_band(uuid)         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_band_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.band_invite_info(text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_band_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_band(uuid)         TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'band_members' AND column_name = 'user_id';
--   SELECT to_regclass('public.band_invites');
--   SELECT proname FROM pg_proc WHERE proname IN ('create_band_invite','band_invite_info','accept_band_invite','leave_band');
