-- ============================================================
-- Bandyou — Migraciones Supabase
-- Ejecutar en Supabase > SQL Editor (safe to re-run)
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. PROFILES — añadir columna role si no existe
-- ──────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT;


-- ──────────────────────────────────────────────
-- 2. MUSICIANS — columnas de disponibilidad
-- ──────────────────────────────────────────────
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS availability_days  TEXT;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS availability_slots TEXT;


-- ──────────────────────────────────────────────
-- 3. BAND_MEMBERS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS band_members (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id     UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  instrument  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE band_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'band_members' AND policyname = 'Anyone can view band members'
  ) THEN
    CREATE POLICY "Anyone can view band members"
      ON band_members FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'band_members' AND policyname = 'Band owner can manage members'
  ) THEN
    CREATE POLICY "Band owner can manage members"
      ON band_members FOR ALL USING (
        EXISTS (SELECT 1 FROM bands WHERE bands.id = band_members.band_id AND bands.user_id = auth.uid())
      );
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 4. BAND_VACANCIES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS band_vacancies (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id     UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  instrument  TEXT NOT NULL,
  description TEXT,
  genre       TEXT,
  open        BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE band_vacancies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'band_vacancies' AND policyname = 'Anyone can view vacancies'
  ) THEN
    CREATE POLICY "Anyone can view vacancies"
      ON band_vacancies FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'band_vacancies' AND policyname = 'Band owner can manage vacancies'
  ) THEN
    CREATE POLICY "Band owner can manage vacancies"
      ON band_vacancies FOR ALL USING (
        EXISTS (SELECT 1 FROM bands WHERE bands.id = band_vacancies.band_id AND bands.user_id = auth.uid())
      );
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 5. VACANCY_APPLICATIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vacancy_applications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vacancy_id  UUID NOT NULL REFERENCES band_vacancies(id) ON DELETE CASCADE,
  musician_id UUID REFERENCES musicians(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vacancy_id, musician_id)
);

ALTER TABLE vacancy_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vacancy_applications' AND policyname = 'Musicians can view their applications'
  ) THEN
    CREATE POLICY "Musicians can view their applications"
      ON vacancy_applications FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vacancy_applications' AND policyname = 'Band owner can view applications'
  ) THEN
    CREATE POLICY "Band owner can view applications"
      ON vacancy_applications FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM band_vacancies bv
          JOIN bands b ON b.id = bv.band_id
          WHERE bv.id = vacancy_applications.vacancy_id AND b.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vacancy_applications' AND policyname = 'Authenticated users can apply'
  ) THEN
    CREATE POLICY "Authenticated users can apply"
      ON vacancy_applications FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vacancy_applications' AND policyname = 'Applicants can delete their applications'
  ) THEN
    CREATE POLICY "Applicants can delete their applications"
      ON vacancy_applications FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 6. REHEARSAL_BOOKINGS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rehearsal_bookings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id    UUID NOT NULL REFERENCES rehearsal_spaces(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  name        TEXT,
  phone       TEXT,
  message     TEXT,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rehearsal_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rehearsal_bookings' AND policyname = 'Space owner can view bookings'
  ) THEN
    CREATE POLICY "Space owner can view bookings"
      ON rehearsal_bookings FOR SELECT USING (
        EXISTS (SELECT 1 FROM rehearsal_spaces WHERE rehearsal_spaces.id = rehearsal_bookings.space_id AND rehearsal_spaces.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rehearsal_bookings' AND policyname = 'Authenticated users can book'
  ) THEN
    CREATE POLICY "Authenticated users can book"
      ON rehearsal_bookings FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rehearsal_bookings' AND policyname = 'Space owner can update booking status'
  ) THEN
    CREATE POLICY "Space owner can update booking status"
      ON rehearsal_bookings FOR UPDATE USING (
        EXISTS (SELECT 1 FROM rehearsal_spaces WHERE rehearsal_spaces.id = rehearsal_bookings.space_id AND rehearsal_spaces.user_id = auth.uid())
      );
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 7. POSTS (feed de anuncios)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN (
                         'musician_seeking_band', 'band_seeking_musician',
                         'event_announcement', 'session_offer', 'gear_sale',
                         'looking_for_rehearsal', 'collab', 'other'
                       )),
  text                 TEXT NOT NULL,
  city                 TEXT,
  instrument           TEXT,
  genre                TEXT,
  author_name          TEXT,
  author_profile_type  TEXT,
  author_profile_id    UUID,
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Anyone can view posts'
  ) THEN
    CREATE POLICY "Anyone can view posts"
      ON posts FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Authenticated users can create posts'
  ) THEN
    CREATE POLICY "Authenticated users can create posts"
      ON posts FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Owners can delete their posts'
  ) THEN
    CREATE POLICY "Owners can delete their posts"
      ON posts FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 8. GEAR_LISTINGS (tienda de equipo)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gear_listings (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT,
  price                NUMERIC,
  category             TEXT,
  condition            TEXT CHECK (condition IN ('new', 'like_new', 'good', 'acceptable')),
  city                 TEXT,
  images               TEXT[],
  status               TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'reserved')),
  seller_name          TEXT,
  seller_profile_type  TEXT,
  seller_profile_id    UUID,
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gear_listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gear_listings' AND policyname = 'Anyone can view active listings'
  ) THEN
    CREATE POLICY "Anyone can view active listings"
      ON gear_listings FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gear_listings' AND policyname = 'Owners can manage their listings'
  ) THEN
    CREATE POLICY "Owners can manage their listings"
      ON gear_listings FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 9. REVIEWS (reseñas de salas / profesores / locales)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('venue', 'teacher', 'rehearsal')),
  entity_id    UUID NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  author_name  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Anyone can view reviews'
  ) THEN
    CREATE POLICY "Anyone can view reviews"
      ON reviews FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Authenticated users can create reviews'
  ) THEN
    CREATE POLICY "Authenticated users can create reviews"
      ON reviews FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Owners can delete their reviews'
  ) THEN
    CREATE POLICY "Owners can delete their reviews"
      ON reviews FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 10. EVENT_RSVPS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_rsvps (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_rsvps' AND policyname = 'Anyone can view RSVPs'
  ) THEN
    CREATE POLICY "Anyone can view RSVPs"
      ON event_rsvps FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_rsvps' AND policyname = 'Authenticated users can RSVP'
  ) THEN
    CREATE POLICY "Authenticated users can RSVP"
      ON event_rsvps FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 11. FAVORITES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can view their favorites'
  ) THEN
    CREATE POLICY "Users can view their favorites"
      ON favorites FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'favorites' AND policyname = 'Users can manage their favorites'
  ) THEN
    CREATE POLICY "Users can manage their favorites"
      ON favorites FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 12. COLUMNAS EXTRA DE PERFIL (redes sociales, nivel, etc.)
-- ──────────────────────────────────────────────

-- Musicians
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS level          TEXT;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS experience     TEXT;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS influences     TEXT;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS contact_email  TEXT;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS spotify_url    TEXT;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS youtube_url    TEXT;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS instagram_url  TEXT;
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS soundcloud_url TEXT;

-- Bands
ALTER TABLE bands ADD COLUMN IF NOT EXISTS contact_email  TEXT;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS spotify_url    TEXT;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS youtube_url    TEXT;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS instagram_url  TEXT;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS website_url    TEXT;

-- Venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS genres        TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS website_url   TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS phone         TEXT;

-- Teachers
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS level           TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS experience      TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS instagram_url   TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS youtube_url     TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS website_url     TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS modality        TEXT DEFAULT 'presencial';

-- Rehearsal spaces
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS contact_email  TEXT;
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS instagram_url  TEXT;
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS website_url    TEXT;
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS phone          TEXT;


-- ──────────────────────────────────────────────
-- Storage bucket para avatares (si no existe)
-- Ejecutar SOLO si el bucket 'avatars' no existe todavía
-- ──────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────
-- 13. CONVERSATIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user1_name      TEXT,
  user2_name      TEXT,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can view their conversations'
  ) THEN
    CREATE POLICY "Users can view their conversations"
      ON conversations FOR SELECT USING (user1_id = auth.uid() OR user2_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can create conversations'
  ) THEN
    CREATE POLICY "Users can create conversations"
      ON conversations FOR INSERT WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can delete their conversations'
  ) THEN
    CREATE POLICY "Users can delete their conversations"
      ON conversations FOR DELETE USING (user1_id = auth.uid() OR user2_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 14. MESSAGES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  read            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Conversation participants can view messages'
  ) THEN
    CREATE POLICY "Conversation participants can view messages"
      ON messages FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
          AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Authenticated users can send messages'
  ) THEN
    CREATE POLICY "Authenticated users can send messages"
      ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can update message read status'
  ) THEN
    CREATE POLICY "Participants can update message read status"
      ON messages FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
          AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can delete messages'
  ) THEN
    CREATE POLICY "Participants can delete messages"
      ON messages FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
          AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
        )
      );
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 15. NOTIFICATIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  entity_type TEXT,
  entity_id   UUID,
  read        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view their notifications'
  ) THEN
    CREATE POLICY "Users can view their notifications"
      ON notifications FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Allows any authenticated user to create notifications for anyone (needed for message notifications)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Authenticated users can create notifications'
  ) THEN
    CREATE POLICY "Authenticated users can create notifications"
      ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update their notifications'
  ) THEN
    CREATE POLICY "Users can update their notifications"
      ON notifications FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 16. RLS: usuarios ven y cancelan sus propias reservas de ensayo
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rehearsal_bookings' AND policyname = 'Users can view their own bookings'
  ) THEN
    CREATE POLICY "Users can view their own bookings"
      ON rehearsal_bookings FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rehearsal_bookings' AND policyname = 'Users can cancel their own bookings'
  ) THEN
    CREATE POLICY "Users can cancel their own bookings"
      ON rehearsal_bookings FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (status = 'cancelled');
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 17. Storage bucket para imágenes de tienda
-- Ejecutar SOLO si el bucket 'gear-images' no existe todavía
-- ──────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('gear-images', 'gear-images', true)
-- ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────
-- 18. Conversations UPDATE policy (participants can update last_message)
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Participants can update conversation'
  ) THEN
    CREATE POLICY "Participants can update conversation"
      ON conversations FOR UPDATE USING (user1_id = auth.uid() OR user2_id = auth.uid());
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 19. Performance indexes
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id   ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_read       ON messages(sender_id, read);
CREATE INDEX IF NOT EXISTS idx_messages_unread_lookup     ON messages(conversation_id, sender_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_read    ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_conversations_user1_id     ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id     ON conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg_at  ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_band_members_band_id       ON band_members(band_id);
CREATE INDEX IF NOT EXISTS idx_band_vacancies_band_id     ON band_vacancies(band_id);
CREATE INDEX IF NOT EXISTS idx_vacancy_apps_musician_id   ON vacancy_applications(musician_id);
CREATE INDEX IF NOT EXISTS idx_vacancy_apps_vacancy_id    ON vacancy_applications(vacancy_id);


-- ──────────────────────────────────────────────
-- 20. Fix messages column name (may have been created as 'content' instead of 'text')
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'content'
  ) THEN
    ALTER TABLE messages RENAME COLUMN content TO text;
  END IF;
END $$;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS text TEXT;


-- ──────────────────────────────────────────────
-- 21. Realtime: REPLICA IDENTITY FULL for filtered subscriptions
-- Required for postgres_changes with filter= to work correctly
-- ──────────────────────────────────────────────
ALTER TABLE messages       REPLICA IDENTITY FULL;
ALTER TABLE conversations  REPLICA IDENTITY FULL;
ALTER TABLE notifications  REPLICA IDENTITY FULL;


-- ──────────────────────────────────────────────
-- 21. Fix notification INSERT policy
-- Drop old restrictive policy (only allowed self-notifications)
-- ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'System can create notifications'
  ) THEN
    DROP POLICY "System can create notifications" ON notifications;
  END IF;
END $$;


-- ──────────────────────────────────────────────
-- 22. PUSH_SUBSCRIPTIONS (Web Push notifications)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users can manage their push subscriptions'
  ) THEN
    CREATE POLICY "Users can manage their push subscriptions"
      ON push_subscriptions FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
