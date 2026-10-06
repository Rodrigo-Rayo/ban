-- ═══════════════════════════════════════════════════════════════════════════
-- Sin perfil solo se puede mirar (2026-10-06). Idempotente.
--
-- Una cuenta sin perfil (ni "soy público" ni ficha de músico, banda, sala,
-- profesor o local) no puede crear nada: anuncios, mensajes, favoritos,
-- reseñas, eventos, artículos, alertas ni nada de La quedada. Sí puede leer.
-- La web ya lo explica y manda a crear el perfil (ProfileGateService); esto
-- lo garantiza en la base de datos aunque alguien se salte la web.
--
-- Son políticas RESTRICTIVE solo para INSERT: se suman a las que ya hay
-- (no quitan nada) y no afectan a leer, editar ni borrar lo propio. Las tablas
-- de perfil (profiles, musicians, bands…) no se tocan: el registro sigue igual.
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Mismo criterio que la web (src/app/core/utils/profile-check.ts):
-- rol "listener" en profiles, o una ficha propia en alguna tabla de perfil.
CREATE OR REPLACE FUNCTION public.has_profile(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.profiles         WHERE id = p_user AND role = 'listener')
    OR EXISTS (SELECT 1 FROM public.musicians        WHERE user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.bands            WHERE user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.venues           WHERE user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.teachers         WHERE user_id = p_user)
    OR EXISTS (SELECT 1 FROM public.rehearsal_spaces WHERE user_id = p_user)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_profile(uuid) TO authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'posts', 'gear_listings', 'events', 'conversations', 'messages', 'favorites',
    'reviews', 'vacancy_applications', 'band_vacancies', 'rehearsal_bookings',
    'quedada_entries', 'quedada_attendees', 'quedada_comments', 'post_alerts'
  ] LOOP
    -- Tablas que aún no existan en esta base de datos se saltan.
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'require profile to create', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_profile((SELECT auth.uid())))',
      'require profile to create', t);
  END LOOP;
END;
$$;

COMMIT;

-- Verificar (debe listar una fila por tabla existente):
--   SELECT tablename FROM pg_policies WHERE policyname = 'require profile to create' ORDER BY 1;
