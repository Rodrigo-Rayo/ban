-- ═══════════════════════════════════════════════════════════════════════════
-- Security audit 2026-09 — RLS / storage / RPC hardening
--
-- Run in Supabase Dashboard → SQL Editor. Idempotent: safe to re-run.
-- Findings confirmed LIVE with the public anon key are marked [LIVE].
--
-- BEFORE running, inspect the live policies (the deployed DB has policies
-- that are not in this repo):
--   SELECT tablename, policyname, cmd, roles, qual, with_check
--   FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY 1, 2;
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Drops every SELECT (or ALL) policy on a table so stale dashboard-created
-- "Enable read access for all users" policies cannot survive the fix.
CREATE OR REPLACE FUNCTION pg_temp.drop_select_policies(p_table TEXT) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table AND cmd IN ('SELECT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, p_table);
  END LOOP;
END $$;

-- ── C1 [LIVE] profiles: anon could read every user's email ─────────────────
-- The app only ever reads the caller's own row (guard, callback, dashboard,
-- onboarding); names of other users go through get_profile_name (SECURITY DEFINER).
SELECT pg_temp.drop_select_policies('profiles');
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = (SELECT auth.uid()));
-- profiles had FOR ALL policies dropped above too — restore owner writes.
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
-- Email already lives in auth.users. With the owner-only policy above each user
-- can only see their own; consider `ALTER TABLE profiles DROP COLUMN email;`
-- once you confirm nothing (trigger / dashboard) writes it.

-- ── H2 [LIVE] vacancy_applications readable by anon ────────────────────────
SELECT pg_temp.drop_select_policies('vacancy_applications');
CREATE POLICY "Musicians can view their applications" ON vacancy_applications
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Band owner can view applications" ON vacancy_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM band_vacancies bv JOIN bands b ON b.id = bv.band_id
      WHERE bv.id = vacancy_applications.vacancy_id AND b.user_id = (SELECT auth.uid())
    )
  );
-- Applicants cannot self-accept. `status` exists live but not in migrations.sql,
-- so only reference it when present (otherwise CREATE POLICY would abort the script).
DROP POLICY IF EXISTS "Authenticated users can apply" ON vacancy_applications;
DO $ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'vacancy_applications' AND column_name = 'status') THEN
    CREATE POLICY "Authenticated users can apply" ON vacancy_applications
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'pending');
  ELSE
    CREATE POLICY "Authenticated users can apply" ON vacancy_applications
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $;

-- ── H3 [LIVE] event_rsvps readable by anon ─────────────────────────────────
SELECT pg_temp.drop_select_policies('event_rsvps');
CREATE POLICY "Users can view their own RSVPs" ON event_rsvps
  FOR SELECT USING (user_id = (SELECT auth.uid()));
-- The helper also dropped the FOR ALL policy — restore owner writes.
DROP POLICY IF EXISTS "Users manage own RSVPs" ON event_rsvps;
CREATE POLICY "Users manage own RSVPs" ON event_rsvps
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users delete own RSVPs" ON event_rsvps;
CREATE POLICY "Users delete own RSVPs" ON event_rsvps
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ── H5 messages: recipients could rewrite text / sender_id ─────────────────
-- Column-level grant: whatever the policy says, only `read` is updatable.
REVOKE UPDATE ON messages FROM authenticated, anon;
GRANT UPDATE (read) ON messages TO authenticated;

-- ── M4 rehearsal_bookings: users could insert status='confirmed' ───────────
DROP POLICY IF EXISTS "Users can create bookings" ON rehearsal_bookings;
DROP POLICY IF EXISTS "Authenticated users can book" ON rehearsal_bookings;
CREATE POLICY "Authenticated users can book" ON rehearsal_bookings
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'pending');

-- ── M2 create_notification: no spoofed 'system' notifications ──────────────
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id     UUID,
  p_type        TEXT,
  p_title       TEXT,
  p_body        TEXT  DEFAULT NULL,
  p_entity_type TEXT  DEFAULT NULL,
  p_entity_id   UUID  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := (SELECT auth.uid());
  recent_count INT;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF caller = p_user_id THEN
    RETURN; -- never notify yourself
  END IF;
  -- System / reminder notifications are server-generated only.
  IF p_type NOT IN ('message', 'application', 'review', 'favorite', 'booking', 'rsvp') THEN
    RAISE EXCEPTION 'Notification type not allowed';
  END IF;
  IF p_entity_type IS NOT NULL AND p_entity_type NOT IN
     ('musician', 'band', 'venue', 'teacher', 'rehearsal', 'event', 'gear', 'post', 'conversation', 'vacancy') THEN
    RAISE EXCEPTION 'Invalid entity type';
  END IF;
  IF char_length(p_title) > 200 THEN
    RAISE EXCEPTION 'Notification title too long';
  END IF;
  IF p_body IS NOT NULL AND char_length(p_body) > 1000 THEN
    RAISE EXCEPTION 'Notification body too long';
  END IF;
  -- Rate limit per recipient (anti-spam) …
  SELECT COUNT(*) INTO recent_count FROM notifications
  WHERE user_id = p_user_id AND created_at > now() - interval '1 hour';
  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Notification rate limit exceeded';
  END IF;
  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_entity_type, p_entity_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
DO $ BEGIN
  IF to_regprocedure('public.delete_user_account()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
  END IF;
END $;

-- ── M3 storage: uploads only into the caller's own folder, images only ─────
DROP POLICY IF EXISTS "Authenticated can upload gear images" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own gear images" ON storage.objects;
CREATE POLICY "Users upload own gear images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gear-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "avatar insert own" ON storage.objects;
DROP POLICY IF EXISTS "avatar update own" ON storage.objects;
DROP POLICY IF EXISTS "avatar delete own" ON storage.objects;
CREATE POLICY "avatar insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "avatar update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "avatar delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

UPDATE storage.buckets
SET file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
WHERE id IN ('avatars', 'gear-images');

COMMIT;

-- ── Verify (run as anon, e.g. curl with the anon key) ──────────────────────
--   GET /rest/v1/profiles?select=id            → []
--   GET /rest/v1/vacancy_applications?select=id → []
--   GET /rest/v1/event_rsvps?select=id          → []
-- Upload paths verified: dashboard avatar = `${uid}/avatar`, gear = `${uid}/<uuid>.<ext>`.
