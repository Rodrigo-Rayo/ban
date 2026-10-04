-- ═══════════════════════════════════════════════════════════════════════════
-- Arregla "Eliminar mi cuenta" (2026-10-04). Idempotente.
--
-- La versión anterior de delete_user_account() hacía DELETE directo sobre
-- storage.objects; Supabase lo bloquea ("Direct deletion from storage tables is
-- not allowed") y TODO el borrado fallaba. La app ya borra los archivos del
-- usuario por la Storage API antes de llamar a esta función, así que aquí solo
-- se borran filas. Las tablas que no existan en esta base se saltan.
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  step record;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rows that point at the user's bands go first (vacancies, members, applications).
  IF to_regclass('public.vacancy_applications') IS NOT NULL AND to_regclass('public.band_vacancies') IS NOT NULL THEN
    DELETE FROM vacancy_applications WHERE vacancy_id IN (
      SELECT v.id FROM band_vacancies v JOIN bands b ON b.id = v.band_id WHERE b.user_id = uid);
  END IF;
  IF to_regclass('public.band_vacancies') IS NOT NULL THEN
    DELETE FROM band_vacancies WHERE band_id IN (SELECT id FROM bands WHERE user_id = uid);
  END IF;
  IF to_regclass('public.band_members') IS NOT NULL THEN
    DELETE FROM band_members WHERE band_id IN (SELECT id FROM bands WHERE user_id = uid);
  END IF;
  IF to_regclass('public.rehearsal_bookings') IS NOT NULL THEN
    DELETE FROM rehearsal_bookings WHERE space_id IN (SELECT id FROM rehearsal_spaces WHERE user_id = uid);
  END IF;
  IF to_regclass('public.event_rsvps') IS NOT NULL THEN
    DELETE FROM event_rsvps WHERE event_id IN (SELECT id FROM events WHERE user_id = uid);
  END IF;

  -- Everything the user owns, by owner column.
  FOR step IN SELECT * FROM (VALUES
    ('vacancy_applications', 'user_id'), ('event_rsvps', 'user_id'), ('rehearsal_bookings', 'user_id'),
    ('favorites', 'user_id'), ('reviews', 'user_id'), ('notifications', 'user_id'),
    ('push_subscriptions', 'user_id'),
    ('posts', 'user_id'), ('events', 'user_id'), ('gear_listings', 'user_id'),
    ('conversations', 'user1_id'), ('conversations', 'user2_id'),   -- messages cascade
    ('musicians', 'user_id'), ('bands', 'user_id'), ('venues', 'user_id'),
    ('teachers', 'user_id'), ('rehearsal_spaces', 'user_id'),
    ('profiles', 'id')
  ) AS t(tbl, col) LOOP
    IF to_regclass('public.' || step.tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', step.tbl, step.col) USING uid;
    END IF;
  END LOOP;

  -- Finally the login itself.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verificar: entra en la web con la cuenta a borrar → Mi panel → Eliminar cuenta.
