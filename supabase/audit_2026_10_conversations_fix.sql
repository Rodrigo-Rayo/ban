-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: "infinite recursion detected in policy for relation conversations".
-- The live UPDATE policy pinned participants with a subquery on conversations
-- itself, which re-enters RLS. Pin them with a column grant instead.
-- Found by the 2026-10-01 two-user E2E test. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "Participants can update conversation" ON conversations;
CREATE POLICY "Participants can update conversation" ON conversations FOR UPDATE TO authenticated
  USING (user1_id = (SELECT auth.uid()) OR user2_id = (SELECT auth.uid()))
  WITH CHECK (user1_id = (SELECT auth.uid()) OR user2_id = (SELECT auth.uid()));

-- Only the preview columns are client-writable (the messages trigger keeps them
-- current anyway); participants and names can no longer be changed.
REVOKE UPDATE ON conversations FROM authenticated, anon;
GRANT UPDATE (last_message, last_message_at) ON conversations TO authenticated;

COMMIT;
