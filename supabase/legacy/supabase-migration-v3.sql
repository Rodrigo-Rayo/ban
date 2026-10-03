-- ============================================================
-- BandYou — Migration v3
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Guardar nombres en conversaciones (para mostrarlos sin queries extras)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user1_name text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user2_name text;

-- 2. Permitir a participantes borrar sus conversaciones
DROP POLICY IF EXISTS "Participants can delete conversations" ON conversations;
CREATE POLICY "Participants can delete conversations" ON conversations
  FOR DELETE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 3. Permitir a participantes borrar mensajes de sus conversaciones
DROP POLICY IF EXISTS "Participants can delete messages" ON messages;
CREATE POLICY "Participants can delete messages" ON messages
  FOR DELETE USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );
