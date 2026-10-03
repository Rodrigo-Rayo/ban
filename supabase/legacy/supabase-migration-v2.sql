-- ============================================================
-- BandYou — Migration v2
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. FAVORITES
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users NOT NULL,
  entity_type  text NOT NULL, -- 'musician' | 'band' | 'venue' | 'event' | 'teacher' | 'rehearsal'
  entity_id    uuid NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites(user_id);

-- 2. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  type        text NOT NULL,   -- 'application' | 'message' | 'review' | 'info'
  title       text NOT NULL,
  body        text,
  entity_type text,
  entity_id   uuid,
  read        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, read);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 3. ADD STATUS TO VACANCY APPLICATIONS
-- ============================================================
ALTER TABLE vacancy_applications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
-- status values: 'pending' | 'accepted' | 'rejected'

-- 4. ADD AVATAR URL TO ALL PROFILE TABLES
-- ============================================================
ALTER TABLE musicians       ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE bands           ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE venues          ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE teachers        ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS avatar_url text;

-- 5. STORAGE BUCKET FOR AVATARS
-- ============================================================
-- Ejecutar en Supabase > Storage > New bucket > name: "avatars", public: true
-- Luego añadir estas políticas en Storage > Policies:

-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');

-- CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
--   USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE
--   USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
