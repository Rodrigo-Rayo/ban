-- Fix: Recipients can tamper with received message content via RLS bypass
-- The original UPDATE policy only checks `read = true` in WITH CHECK,
-- allowing recipients to also modify text, sender_id, and conversation_id.
-- This migration pins all immutable columns.
--
-- Run this in Supabase Dashboard → SQL Editor or via supabase db push.

DROP POLICY IF EXISTS "Recipients can mark messages read" ON messages;

CREATE POLICY "Recipients can mark messages read"
  ON messages FOR UPDATE
  USING (
    sender_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND (conversations.user1_id = (SELECT auth.uid())
          OR conversations.user2_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    read = true
    AND text             = (SELECT m.text             FROM messages m WHERE m.id = messages.id)
    AND sender_id        = (SELECT m.sender_id        FROM messages m WHERE m.id = messages.id)
    AND conversation_id  = (SELECT m.conversation_id  FROM messages m WHERE m.id = messages.id)
  );
