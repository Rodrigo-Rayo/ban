-- ═══════════════════════════════════════════════════════════════════════════
-- Messaging hardening (run AFTER audit_2026_09_security_fixes.sql). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Server-side length cap matching the client (MAX_MESSAGE_LENGTH = 2000).
-- NOT VALID: existing rows are not checked, new ones are.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_text_len;
ALTER TABLE messages ADD CONSTRAINT messages_text_len
  CHECK (text IS NOT NULL AND char_length(btrim(text)) BETWEEN 1 AND 2000) NOT VALID;

-- Exactly-once push: send-push claims a message with
--   UPDATE messages SET push_sent_at = now() WHERE id = $1 AND push_sent_at IS NULL RETURNING id
-- (service role only; authenticated users can still update just `read`).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

-- Conversation preview maintained by the database, so it always reflects the
-- real last message (the client update stays as a harmless fallback).
CREATE OR REPLACE FUNCTION public.bump_conversation_on_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- now(), not NEW.created_at: a client-supplied created_at must not reorder inboxes.
  UPDATE public.conversations
  SET last_message = left(NEW.text, 140), last_message_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_conversation ON messages;
CREATE TRIGGER trg_bump_conversation AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_on_message();
REVOKE EXECUTE ON FUNCTION public.bump_conversation_on_message() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Check Realtime publishes the tables the app subscribes to (expect both rows):
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND tablename IN ('messages', 'notifications');
