-- ═══════════════════════════════════════════════════════════════════════════
-- Security audit 2026-09 — RLS / storage / RPC hardening
--
-- Written against the LIVE policies (read via pg_policies on 2026-10-01), which
-- differ from supabase/migrations.sql: the dashboard accumulated duplicate,
-- permissive policies. Permissive policies are OR-ed, so one weak policy opens
-- the whole table — this script drops the weak ones by name.
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── C1 profiles: anon could read every user's email ────────────────────────
-- App only reads the caller's own row; other users' names go through
-- get_profile_name (SECURITY DEFINER).
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Lectura pública" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = (SELECT auth.uid()));

-- ── H2 vacancy_applications: public read + forgeable insert ────────────────
DROP POLICY IF EXISTS "Public read applications" ON vacancy_applications;
-- WITH CHECK was only `auth.uid() IS NOT NULL` → apply on behalf of anyone.
DROP POLICY IF EXISTS "Musicians can insert applications" ON vacancy_applications;
DROP POLICY IF EXISTS "Authenticated users can apply" ON vacancy_applications;
CREATE POLICY "Authenticated users can apply" ON vacancy_applications
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    AND coalesce(status, 'pending') = 'pending'
    -- cannot apply with someone else's musician profile (UNIQUE(vacancy_id, musician_id) would block them)
    AND (musician_id IS NULL OR EXISTS (SELECT 1 FROM musicians m WHERE m.id = musician_id AND m.user_id = (SELECT auth.uid())))
  );
-- "Musicians manage own applications" (ALL, USING auth.uid() = user_id) let an
-- applicant UPDATE their own status to 'accepted'. Read/delete stay covered by
-- "Musicians can view their applications" and "Applicants can delete their applications".
DROP POLICY IF EXISTS "Musicians manage own applications" ON vacancy_applications;

-- ── H3 event_rsvps: public read ────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read RSVPs" ON event_rsvps;

-- ── H5 messages: forged sender / edit + delete others' messages ────────────
-- ALL policy without WITH CHECK: any participant could INSERT with another
-- sender_id, and UPDATE/DELETE any message in the conversation.
DROP POLICY IF EXISTS "Ver mensajes de mis conversaciones" ON messages;
-- UPDATE without WITH CHECK: rewrite text of any message in the conversation.
DROP POLICY IF EXISTS "Participants can update messages" ON messages;
-- Re-create the policies messaging needs, so the result does not depend on live state.
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id AND (c.user1_id = (SELECT auth.uid()) OR c.user2_id = (SELECT auth.uid()))));
DROP POLICY IF EXISTS "Conversation participants can view messages" ON messages;
CREATE POLICY "Conversation participants can view messages" ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id
    AND (c.user1_id = (SELECT auth.uid()) OR c.user2_id = (SELECT auth.uid()))));
DROP POLICY IF EXISTS "Recipients can mark messages read" ON messages;
CREATE POLICY "Recipients can mark messages read" ON messages FOR UPDATE TO authenticated
  USING (sender_id <> (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id AND (c.user1_id = (SELECT auth.uid()) OR c.user2_id = (SELECT auth.uid()))))
  WITH CHECK (read = true);
DROP POLICY IF EXISTS "Senders can delete own messages" ON messages;
CREATE POLICY "Senders can delete own messages" ON messages FOR DELETE TO authenticated
  USING (sender_id = (SELECT auth.uid()));
-- Belt and braces: only the `read` flag is ever updatable.
REVOKE UPDATE ON messages FROM authenticated, anon;
GRANT UPDATE (read) ON messages TO authenticated;

-- ── conversations: UPDATE without WITH CHECK could swap the other participant
-- ("Participants can update conversation" — singular — pins the ids and stays).
DROP POLICY IF EXISTS "Actualizar propias conversaciones" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;

-- ── rehearsal_bookings: book on behalf of anyone / self-confirm ─────────────
DROP POLICY IF EXISTS "Authenticated can insert bookings" ON rehearsal_bookings;
DROP POLICY IF EXISTS "Authenticated users can book" ON rehearsal_bookings;
CREATE POLICY "Authenticated users can book" ON rehearsal_bookings
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'pending');
-- Owner and booker UPDATE policies have no column limits; the app only changes status.
REVOKE UPDATE ON rehearsal_bookings FROM authenticated, anon;
GRANT UPDATE (status) ON rehearsal_bookings TO authenticated;
DROP POLICY IF EXISTS "Users can cancel their own bookings" ON rehearsal_bookings;
CREATE POLICY "Users can cancel their own bookings" ON rehearsal_bookings FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'cancelled');

-- ── M2 create_notification: no spoofed 'system' notifications ──────────────
-- sender_id lets the rate limit count per caller (one spammer cannot exhaust a victim's quota).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id UUID;
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
  -- Per caller: 20/hour across all recipients, 5/hour to the same recipient.
  SELECT COUNT(*) INTO recent_count FROM notifications
  WHERE sender_id = caller AND created_at > now() - interval '1 hour';
  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Notification rate limit exceeded';
  END IF;
  SELECT COUNT(*) INTO recent_count FROM notifications
  WHERE sender_id = caller AND user_id = p_user_id AND created_at > now() - interval '1 hour';
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Notification rate limit exceeded';
  END IF;
  INSERT INTO notifications (user_id, sender_id, type, title, body, entity_type, entity_id)
  VALUES (p_user_id, caller, p_type, p_title, p_body, p_entity_type, p_entity_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- ── M3 storage: uploads only into the caller's own folder ──────────────────
-- Both INSERT policies only checked the bucket → write into anyone's folder.
DROP POLICY IF EXISTS "Auth upload avatars 1oj01fe_0" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload gear images" ON storage.objects;
DROP POLICY IF EXISTS "avatar insert own" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own gear images" ON storage.objects;
CREATE POLICY "avatar insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "Users upload own gear images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gear-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
-- Avatar re-upload (upsert) is an UPDATE: pin both the old and the new path to the caller's folder.
DROP POLICY IF EXISTS "Users update own avatar 1oj01fe_0" ON storage.objects;
DROP POLICY IF EXISTS "avatar update own" ON storage.objects;
CREATE POLICY "avatar update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

UPDATE storage.buckets
SET file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
WHERE id IN ('avatars', 'gear-images');

-- Review: no INSERT/UPDATE/ALL policy should lack an ownership check.
SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('messages','conversations','rehearsal_bookings','vacancy_applications','profiles','event_rsvps')
ORDER BY 1, 3;

COMMIT;

-- ── Verify (as anon, with the public anon key) ─────────────────────────────
--   GET /rest/v1/profiles?select=id             → []
--   GET /rest/v1/vacancy_applications?select=id → []
--   GET /rest/v1/event_rsvps?select=id          → []
-- Upload paths verified: dashboard avatar = `${uid}/avatar`, gear = `${uid}/<uuid>.<ext>`.
