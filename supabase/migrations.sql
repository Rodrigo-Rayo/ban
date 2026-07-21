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
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS opening_hours  TEXT;


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


-- ──────────────────────────────────────────────
-- 23. Performance indexes — profile tables by user_id
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_musicians_user_id         ON musicians(user_id);
CREATE INDEX IF NOT EXISTS idx_bands_user_id             ON bands(user_id);
CREATE INDEX IF NOT EXISTS idx_venues_user_id            ON venues(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id          ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_spaces_user_id  ON rehearsal_spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id            ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date               ON events(date);
CREATE INDEX IF NOT EXISTS idx_posts_created_at          ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_city_type           ON posts(city, type);
CREATE INDEX IF NOT EXISTS idx_gear_listings_status      ON gear_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id         ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_entity          ON favorites(user_id, entity_type);


-- ──────────────────────────────────────────────
-- 24. Security hardening + performance improvements
-- ──────────────────────────────────────────────

-- Fix messages INSERT: require the sender to be a conversation participant
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Authenticated users can send messages'
  ) THEN
    DROP POLICY "Authenticated users can send messages" ON messages;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can send messages'
  ) THEN
    CREATE POLICY "Participants can send messages"
      ON messages FOR INSERT WITH CHECK (
        sender_id = (SELECT auth.uid())
        AND EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
          AND (conversations.user1_id = (SELECT auth.uid()) OR conversations.user2_id = (SELECT auth.uid()))
        )
      );
  END IF;
END $$;

-- Fix messages UPDATE: add WITH CHECK so only the read flag can be set to true
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can update message read status'
  ) THEN
    DROP POLICY "Participants can update message read status" ON messages;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can mark messages read'
  ) THEN
    CREATE POLICY "Participants can mark messages read"
      ON messages FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
          AND (conversations.user1_id = (SELECT auth.uid()) OR conversations.user2_id = (SELECT auth.uid()))
        )
      )
      WITH CHECK (read = true);
  END IF;
END $$;

-- Fix messages DELETE: only the sender can delete their own messages
-- (conversation deletion cascades automatically, so deleteConversation still works)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Participants can delete messages'
  ) THEN
    DROP POLICY "Participants can delete messages" ON messages;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Senders can delete own messages'
  ) THEN
    CREATE POLICY "Senders can delete own messages"
      ON messages FOR DELETE USING (sender_id = (SELECT auth.uid()));
  END IF;
END $$;

-- Add message length constraint to prevent storage abuse
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'messages_text_length_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_text_length_check CHECK (char_length(text) <= 5000);
  END IF;
END $$;

-- Unified profile name lookup (replaces 5 parallel client queries)
CREATE OR REPLACE FUNCTION get_profile_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT name FROM (
    SELECT name FROM musicians        WHERE user_id = p_user_id
    UNION ALL
    SELECT name FROM bands            WHERE user_id = p_user_id
    UNION ALL
    SELECT name FROM venues           WHERE user_id = p_user_id
    UNION ALL
    SELECT name FROM teachers         WHERE user_id = p_user_id
    UNION ALL
    SELECT name FROM rehearsal_spaces WHERE user_id = p_user_id
  ) t
  WHERE name IS NOT NULL
  LIMIT 1;
$$;

-- Unified profile avatar lookup
CREATE OR REPLACE FUNCTION get_profile_avatar(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT avatar_url FROM (
    SELECT avatar_url FROM musicians        WHERE user_id = p_user_id
    UNION ALL
    SELECT avatar_url FROM bands            WHERE user_id = p_user_id
    UNION ALL
    SELECT avatar_url FROM venues           WHERE user_id = p_user_id
    UNION ALL
    SELECT avatar_url FROM teachers         WHERE user_id = p_user_id
    UNION ALL
    SELECT avatar_url FROM rehearsal_spaces WHERE user_id = p_user_id
  ) t
  WHERE avatar_url IS NOT NULL
  LIMIT 1;
$$;

-- Missing indexes on frequently queried foreign keys
CREATE INDEX IF NOT EXISTS idx_rehearsal_bookings_space_id ON rehearsal_bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_bookings_user_id  ON rehearsal_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_vacancy_apps_user_id        ON vacancy_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id               ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_gear_listings_user_id       ON gear_listings(user_id);

-- Conditional indexes for tables that may have been created outside this migration file
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_entity   ON reviews(entity_type, entity_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_user_id  ON reviews(user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_rsvps' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id  ON event_rsvps(user_id)';
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 25. DELETE USER ACCOUNT (RGPD compliant)
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Remove storage objects (avatar)
  DELETE FROM storage.objects WHERE bucket_id = 'avatars' AND owner = uid::text;

  -- User-owned data
  DELETE FROM favorites            WHERE user_id = uid;
  DELETE FROM notifications        WHERE user_id = uid;
  DELETE FROM rehearsal_bookings   WHERE user_id = uid;
  DELETE FROM posts                WHERE user_id = uid;
  DELETE FROM events               WHERE user_id = uid;
  DELETE FROM gear_listings        WHERE user_id = uid;
  DELETE FROM vacancy_applications WHERE user_id = uid;

  -- Conversations (messages cascade via FK)
  DELETE FROM conversations WHERE user1_id = uid OR user2_id = uid;

  -- Profile tables (band_members / band_vacancies cascade from bands)
  DELETE FROM musicians        WHERE user_id = uid;
  DELETE FROM bands            WHERE user_id = uid;
  DELETE FROM venues           WHERE user_id = uid;
  DELETE FROM teachers         WHERE user_id = uid;
  DELETE FROM rehearsal_spaces WHERE user_id = uid;
  DELETE FROM profiles         WHERE id = uid;

  -- Finally delete the auth record (cascades push_subscriptions, etc.)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;


-- Full-text search indexes for ILIKE queries (requires pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_musicians_name_trgm       ON musicians        USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_musicians_instrument_trgm ON musicians        USING gin(instrument gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bands_name_trgm           ON bands            USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_venues_name_trgm          ON venues           USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_teachers_name_trgm        ON teachers         USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rehearsal_name_trgm       ON rehearsal_spaces USING gin(name gin_trgm_ops);


-- Fix: Add WITH CHECK to conversations UPDATE policy to prevent column hijacking
DROP POLICY IF EXISTS "Participants can update conversation" ON conversations;
CREATE POLICY "Participants can update conversation"
  ON conversations FOR UPDATE
  USING (user1_id = auth.uid() OR user2_id = auth.uid())
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- Fix: Add WITH CHECK to notifications UPDATE policy to restrict to read-only changes
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ──────────────────────────────────────────────
-- ON DELETE CASCADE en todas las FK a auth.users
-- Permite borrar usuarios desde el dashboard sin errores de FK
-- ──────────────────────────────────────────────
ALTER TABLE profiles              DROP CONSTRAINT profiles_id_fkey,
                                  ADD CONSTRAINT profiles_id_fkey                  FOREIGN KEY (id)        REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE musicians             DROP CONSTRAINT musicians_user_id_fkey,
                                  ADD CONSTRAINT musicians_user_id_fkey            FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bands                 DROP CONSTRAINT bands_user_id_fkey,
                                  ADD CONSTRAINT bands_user_id_fkey                FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE venues                DROP CONSTRAINT venues_user_id_fkey,
                                  ADD CONSTRAINT venues_user_id_fkey               FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE events                DROP CONSTRAINT events_user_id_fkey,
                                  ADD CONSTRAINT events_user_id_fkey               FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE conversations         DROP CONSTRAINT conversations_user1_id_fkey,
                                  ADD CONSTRAINT conversations_user1_id_fkey       FOREIGN KEY (user1_id)  REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE conversations         DROP CONSTRAINT conversations_user2_id_fkey,
                                  ADD CONSTRAINT conversations_user2_id_fkey       FOREIGN KEY (user2_id)  REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE messages              DROP CONSTRAINT messages_sender_id_fkey,
                                  ADD CONSTRAINT messages_sender_id_fkey           FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE teachers              DROP CONSTRAINT teachers_user_id_fkey,
                                  ADD CONSTRAINT teachers_user_id_fkey             FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE rehearsal_spaces      DROP CONSTRAINT rehearsal_spaces_user_id_fkey,
                                  ADD CONSTRAINT rehearsal_spaces_user_id_fkey     FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE vacancy_applications  DROP CONSTRAINT vacancy_applications_user_id_fkey,
                                  ADD CONSTRAINT vacancy_applications_user_id_fkey FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE favorites             DROP CONSTRAINT favorites_user_id_fkey,
                                  ADD CONSTRAINT favorites_user_id_fkey            FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE notifications         DROP CONSTRAINT notifications_user_id_fkey,
                                  ADD CONSTRAINT notifications_user_id_fkey        FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE rehearsal_bookings    DROP CONSTRAINT rehearsal_bookings_user_id_fkey,
                                  ADD CONSTRAINT rehearsal_bookings_user_id_fkey   FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE posts                 DROP CONSTRAINT posts_user_id_fkey,
                                  ADD CONSTRAINT posts_user_id_fkey                FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE gear_listings         DROP CONSTRAINT gear_listings_user_id_fkey,
                                  ADD CONSTRAINT gear_listings_user_id_fkey        FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE event_rsvps           DROP CONSTRAINT event_rsvps_user_id_fkey,
                                  ADD CONSTRAINT event_rsvps_user_id_fkey          FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE reviews               DROP CONSTRAINT reviews_user_id_fkey,
                                  ADD CONSTRAINT reviews_user_id_fkey              FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE push_subscriptions    DROP CONSTRAINT push_subscriptions_user_id_fkey,
                                  ADD CONSTRAINT push_subscriptions_user_id_fkey   FOREIGN KEY (user_id)   REFERENCES auth.users(id) ON DELETE CASCADE;


-- ──────────────────────────────────────────────
-- Listener profile: name column on profiles
-- ──────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- Allow 'listener' in profiles.role (drop old constraint and recreate with full list)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('musician', 'band', 'venue', 'teacher', 'rehearsal', 'listener'));

-- Update get_profile_name to include listener name from profiles table
CREATE OR REPLACE FUNCTION get_profile_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT name FROM (
        SELECT name FROM musicians        WHERE user_id = p_user_id
        UNION ALL
        SELECT name FROM bands            WHERE user_id = p_user_id
        UNION ALL
        SELECT name FROM venues           WHERE user_id = p_user_id
        UNION ALL
        SELECT name FROM teachers         WHERE user_id = p_user_id
        UNION ALL
        SELECT name FROM rehearsal_spaces WHERE user_id = p_user_id
      ) t
      WHERE name IS NOT NULL
      LIMIT 1
    ),
    (SELECT name FROM profiles WHERE id = p_user_id AND name IS NOT NULL LIMIT 1)
  );
$$;


-- ──────────────────────────────────────────────
-- 26. Harden notifications INSERT policy
--
-- Problem: the previous policy "Authenticated users can create notifications"
-- allowed auth.uid() IS NOT NULL, meaning any logged-in user could insert a
-- notification targeting any other user — a spam/harassment vector.
--
-- Solution: Replace direct cross-user INSERT with a SECURITY DEFINER function
-- (create_notification) that is the single controlled path for creating
-- notifications on behalf of another user. Direct INSERTs are now restricted
-- to self-notifications (user_id = auth.uid()) only.
-- ──────────────────────────────────────────────

-- Drop the overly broad policy
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- Allow only self-notifications via direct INSERT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users can create self notifications'
  ) THEN
    CREATE POLICY "Users can create self notifications"
      ON notifications FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Controlled function for cross-user notification creation (e.g. vacancy applications)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id    UUID,
  p_type       TEXT,
  p_title      TEXT,
  p_body       TEXT    DEFAULT NULL,
  p_entity_type TEXT   DEFAULT NULL,
  p_entity_id  UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_entity_type, p_entity_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;


-- ──────────────────────────────────────────────
-- 27. Bug fixes and performance hardening
-- ──────────────────────────────────────────────

-- FIX CRITICAL: delete_user_account had a type mismatch: owner = uid::text
-- storage.objects.owner is uuid; casting uid to text caused "operator does not exist: uuid = text"
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Remove storage objects (avatar) — owner column is uuid, no cast needed
  DELETE FROM storage.objects WHERE bucket_id = 'avatars' AND owner = uid;

  -- User-owned data
  DELETE FROM favorites            WHERE user_id = uid;
  DELETE FROM notifications        WHERE user_id = uid;
  DELETE FROM rehearsal_bookings   WHERE user_id = uid;
  DELETE FROM posts                WHERE user_id = uid;
  DELETE FROM events               WHERE user_id = uid;
  DELETE FROM gear_listings        WHERE user_id = uid;
  DELETE FROM vacancy_applications WHERE user_id = uid;

  -- Conversations (messages cascade via FK)
  DELETE FROM conversations WHERE user1_id = uid OR user2_id = uid;

  -- Profile tables (band_members / band_vacancies cascade from bands)
  DELETE FROM musicians        WHERE user_id = uid;
  DELETE FROM bands            WHERE user_id = uid;
  DELETE FROM venues           WHERE user_id = uid;
  DELETE FROM teachers         WHERE user_id = uid;
  DELETE FROM rehearsal_spaces WHERE user_id = uid;
  DELETE FROM profiles         WHERE id = uid;

  -- Finally delete the auth record (cascades push_subscriptions, etc.)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;


-- FIX HIGH: Replace auth.uid() per-row calls with (SELECT auth.uid()) in RLS policies
-- Per-row auth.uid() calls prevent the planner from caching the value across rows,
-- causing unnecessary overhead on large tables.

-- conversations SELECT: use (SELECT auth.uid()) to evaluate once per query
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  USING (
    user1_id = (SELECT auth.uid()) OR
    user2_id = (SELECT auth.uid())
  );

-- conversations INSERT: same hardening
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    user1_id = (SELECT auth.uid()) OR
    user2_id = (SELECT auth.uid())
  );

-- conversations DELETE
DROP POLICY IF EXISTS "Users can delete their conversations" ON conversations;
CREATE POLICY "Users can delete their conversations"
  ON conversations FOR DELETE
  USING (
    user1_id = (SELECT auth.uid()) OR
    user2_id = (SELECT auth.uid())
  );

-- conversations UPDATE (re-apply with (SELECT auth.uid()))
DROP POLICY IF EXISTS "Participants can update conversation" ON conversations;
CREATE POLICY "Participants can update conversation"
  ON conversations FOR UPDATE
  USING (
    user1_id = (SELECT auth.uid()) OR
    user2_id = (SELECT auth.uid())
  )
  WITH CHECK (
    user1_id = (SELECT auth.uid()) OR
    user2_id = (SELECT auth.uid())
  );

-- messages SELECT: the EXISTS subquery called auth.uid() per-row; harden it
DROP POLICY IF EXISTS "Conversation participants can view messages" ON messages;
CREATE POLICY "Conversation participants can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND (
          conversations.user1_id = (SELECT auth.uid()) OR
          conversations.user2_id = (SELECT auth.uid())
        )
    )
  );

-- notifications SELECT
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- notifications INSERT (self)
DROP POLICY IF EXISTS "Users can create self notifications" ON notifications;
CREATE POLICY "Users can create self notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- notifications UPDATE
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications"
  ON notifications FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- FIX HIGH: Missing composite index on messages(conversation_id, created_at)
-- getMessages() does: .eq('conversation_id', id).order('created_at', { ascending: false })
-- A composite index allows the query to be served entirely from the index (no sort step).
DROP INDEX IF EXISTS idx_messages_conversation_id;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at
  ON messages(conversation_id, created_at DESC);

-- FIX HIGH: Missing composite index on events(city, date)
-- home.component queries: .eq('city', city).gte('date', todayStr).order('date')
-- Composite index on (city, date) covers both the equality filter and the range + sort.
CREATE INDEX IF NOT EXISTS idx_events_city_date
  ON events(city, date ASC)
  WHERE date IS NOT NULL;


-- ── Section 28: City indexes on profile tables ────────────────────────────────
-- home.component queries all five profile tables filtered by city + created_at DESC.
-- These composite indexes let Postgres serve those queries without a full table scan.
CREATE INDEX IF NOT EXISTS idx_musicians_city_created
  ON musicians(city, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bands_city_created
  ON bands(city, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venues_city_created
  ON venues(city, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teachers_city_created
  ON teachers(city, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rehearsal_city_created
  ON rehearsal_spaces(city, created_at DESC);


-- ── Section 29: Social links — missing columns ────────────────────────────────
ALTER TABLE musicians ADD COLUMN IF NOT EXISTS website_url    TEXT;
ALTER TABLE bands     ADD COLUMN IF NOT EXISTS soundcloud_url TEXT;


-- ── Section 30: Fix delete_user_account — add missing table deletes ───────────
-- The previous version was missing explicit DELETEs for reviews, event_rsvps,
-- messages and push_subscriptions. If the ON DELETE CASCADE FK constraints from
-- Section 27 are not yet applied in the live DB, the auth.users delete would
-- fail with a foreign key violation. This version deletes every table explicitly.
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Storage objects
  DELETE FROM storage.objects WHERE bucket_id = 'avatars'      AND owner = uid;
  DELETE FROM storage.objects WHERE bucket_id = 'gear-images'  AND owner = uid;

  -- All user-owned data (explicit, does not rely on CASCADE)
  DELETE FROM reviews              WHERE user_id = uid;
  DELETE FROM event_rsvps          WHERE user_id = uid;
  DELETE FROM push_subscriptions   WHERE user_id = uid;
  DELETE FROM favorites            WHERE user_id = uid;
  DELETE FROM notifications        WHERE user_id = uid;
  DELETE FROM rehearsal_bookings   WHERE user_id = uid;
  DELETE FROM posts                WHERE user_id = uid;
  DELETE FROM events               WHERE user_id = uid;
  DELETE FROM gear_listings        WHERE user_id = uid;
  DELETE FROM vacancy_applications WHERE user_id = uid;

  -- Messages then conversations (messages FK → conversations)
  DELETE FROM messages      WHERE sender_id = uid;
  DELETE FROM conversations WHERE user1_id = uid OR user2_id = uid;

  -- Profile tables (cascade clears band_members, band_vacancies, etc.)
  DELETE FROM musicians        WHERE user_id = uid;
  DELETE FROM bands            WHERE user_id = uid;
  DELETE FROM venues           WHERE user_id = uid;
  DELETE FROM teachers         WHERE user_id = uid;
  DELETE FROM rehearsal_spaces WHERE user_id = uid;
  DELETE FROM profiles         WHERE id = uid;

  -- Finally delete the auth record
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;


-- ============= SECTION 31: SECURITY DEFINER functions missing SET search_path =============
-- Fix: get_profile_name and get_profile_avatar are SECURITY DEFINER but lack SET search_path.
-- Without pinning the search_path, a user who can create schemas could shadow the public tables
-- by placing identically-named objects earlier in the search_path, causing these functions to
-- read attacker-controlled data while running with elevated privileges.
-- Both functions are recreated here with SET search_path = public.

CREATE OR REPLACE FUNCTION get_profile_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT name FROM (
        SELECT name FROM musicians        WHERE user_id = p_user_id
        UNION ALL
        SELECT name FROM bands            WHERE user_id = p_user_id
        UNION ALL
        SELECT name FROM venues           WHERE user_id = p_user_id
        UNION ALL
        SELECT name FROM teachers         WHERE user_id = p_user_id
        UNION ALL
        SELECT name FROM rehearsal_spaces WHERE user_id = p_user_id
      ) t
      WHERE name IS NOT NULL
      LIMIT 1
    ),
    (SELECT name FROM profiles WHERE id = p_user_id AND name IS NOT NULL LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION get_profile_avatar(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT avatar_url FROM (
    SELECT avatar_url FROM musicians        WHERE user_id = p_user_id
    UNION ALL
    SELECT avatar_url FROM bands            WHERE user_id = p_user_id
    UNION ALL
    SELECT avatar_url FROM venues           WHERE user_id = p_user_id
    UNION ALL
    SELECT avatar_url FROM teachers         WHERE user_id = p_user_id
    UNION ALL
    SELECT avatar_url FROM rehearsal_spaces WHERE user_id = p_user_id
  ) t
  WHERE avatar_url IS NOT NULL
  LIMIT 1;
$$;


-- ============= SECTION 32: RLS on core profile tables =============
-- Fix: profiles, musicians, bands, venues, teachers, rehearsal_spaces, and events were created
-- outside this migration file (initial Supabase setup). Their RLS status is unknown.
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent on an already-secured table.
-- Policies are guarded with IF NOT EXISTS so re-runs are safe.

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE musicians         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bands             ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues            ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_spaces  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;

-- profiles: public directory — anyone can read; only owner can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Anyone can view profiles') THEN
    CREATE POLICY "Anyone can view profiles"
      ON profiles FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile"
      ON profiles FOR INSERT
      WITH CHECK (id = (SELECT auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update own profile') THEN
    CREATE POLICY "Users can update own profile"
      ON profiles FOR UPDATE
      USING    (id = (SELECT auth.uid()))
      WITH CHECK (id = (SELECT auth.uid()));
  END IF;
END $$;

-- musicians
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='musicians' AND policyname='Anyone can view musicians') THEN
    CREATE POLICY "Anyone can view musicians"
      ON musicians FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='musicians' AND policyname='Musicians can manage own profile') THEN
    CREATE POLICY "Musicians can manage own profile"
      ON musicians FOR ALL
      USING    (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- bands
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bands' AND policyname='Anyone can view bands') THEN
    CREATE POLICY "Anyone can view bands"
      ON bands FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bands' AND policyname='Bands can manage own profile') THEN
    CREATE POLICY "Bands can manage own profile"
      ON bands FOR ALL
      USING    (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- venues
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='venues' AND policyname='Anyone can view venues') THEN
    CREATE POLICY "Anyone can view venues"
      ON venues FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='venues' AND policyname='Venues can manage own profile') THEN
    CREATE POLICY "Venues can manage own profile"
      ON venues FOR ALL
      USING    (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- teachers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teachers' AND policyname='Anyone can view teachers') THEN
    CREATE POLICY "Anyone can view teachers"
      ON teachers FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teachers' AND policyname='Teachers can manage own profile') THEN
    CREATE POLICY "Teachers can manage own profile"
      ON teachers FOR ALL
      USING    (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- rehearsal_spaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rehearsal_spaces' AND policyname='Anyone can view rehearsal spaces') THEN
    CREATE POLICY "Anyone can view rehearsal spaces"
      ON rehearsal_spaces FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rehearsal_spaces' AND policyname='Spaces can manage own profile') THEN
    CREATE POLICY "Spaces can manage own profile"
      ON rehearsal_spaces FOR ALL
      USING    (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='Anyone can view events') THEN
    CREATE POLICY "Anyone can view events"
      ON events FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='Users can manage own events') THEN
    CREATE POLICY "Users can manage own events"
      ON events FOR ALL
      USING    (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;


-- ============= SECTION 33: Data integrity constraints =============

-- Fix: rehearsal_bookings — end_time must be strictly after start_time.
-- Without this, a booking with end_time = start_time or inverted times is accepted.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'rehearsal_bookings_time_order_check'
  ) THEN
    ALTER TABLE rehearsal_bookings
      ADD CONSTRAINT rehearsal_bookings_time_order_check CHECK (end_time > start_time);
  END IF;
END $$;

-- Fix: gear_listings — price must be non-negative when provided.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'gear_listings_price_nonnegative_check'
  ) THEN
    ALTER TABLE gear_listings
      ADD CONSTRAINT gear_listings_price_nonnegative_check CHECK (price IS NULL OR price >= 0);
  END IF;
END $$;

-- Fix: teachers.modality — restrict to known values to prevent garbage data.
-- The column was added with DEFAULT 'presencial' (section 12) but no CHECK.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'teachers_modality_check'
  ) THEN
    ALTER TABLE teachers
      ADD CONSTRAINT teachers_modality_check
      CHECK (modality IS NULL OR modality IN ('presencial', 'online', 'ambas'));
  END IF;
END $$;

-- Fix: favorites.entity_type — restrict to the five known entity types.
-- Currently any arbitrary string is accepted, allowing stale/invalid references.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'favorites_entity_type_check'
  ) THEN
    ALTER TABLE favorites
      ADD CONSTRAINT favorites_entity_type_check
      CHECK (entity_type IN ('musician', 'band', 'venue', 'teacher', 'rehearsal'));
  END IF;
END $$;

-- Fix: band_vacancies.open — set NOT NULL (DEFAULT true is already present, but NULL can
-- be inserted explicitly). Backfill NULLs to the default first to avoid constraint failure.
UPDATE band_vacancies SET open = true WHERE open IS NULL;
ALTER TABLE band_vacancies ALTER COLUMN open SET NOT NULL;

-- Fix: conversations — enforce user1_id < user2_id at the database level.
-- CLAUDE.md documents this ordering convention but only the application enforces it today.
-- A client bug could create a duplicate conversation with the pair in reverse order,
-- bypassing the UNIQUE(user1_id, user2_id) constraint.
-- Guard: only add the constraint if no existing rows violate it.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM conversations WHERE user1_id >= user2_id
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'conversations_user_order_check'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_user_order_check CHECK (user1_id < user2_id);
  END IF;
END $$;


-- ============= SECTION 34: Missing indexes =============

-- Fix: notifications — (user_id, created_at DESC) for inbox/notification-list pagination.
-- The existing idx_notifications_user_read covers (user_id, read) but not ordered retrieval,
-- so any query ordered by created_at forces a sort step on every notification fetch.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Fix: gear_listings — (city, created_at DESC) for city-filtered marketplace browsing.
-- City is a common filter in the marketplace but has no dedicated index.
CREATE INDEX IF NOT EXISTS idx_gear_listings_city_created
  ON gear_listings(city, created_at DESC)
  WHERE city IS NOT NULL;

-- Fix: gear_listings — category index for category-filtered browsing.
CREATE INDEX IF NOT EXISTS idx_gear_listings_category_created
  ON gear_listings(category, created_at DESC)
  WHERE category IS NOT NULL;

-- Fix: rehearsal_bookings — (space_id, date) composite index for overlap detection.
-- Any booking conflict check runs WHERE space_id = $1 AND date = $2. Without this index
-- every check scans all bookings for the space.
CREATE INDEX IF NOT EXISTS idx_rehearsal_bookings_space_date
  ON rehearsal_bookings(space_id, date);

-- Fix: rehearsal_bookings — (user_id, created_at DESC) for the "my bookings" user view.
CREATE INDEX IF NOT EXISTS idx_rehearsal_bookings_user_created
  ON rehearsal_bookings(user_id, created_at DESC);

-- Fix: band_vacancies — partial index on open=true so vacancy search skips closed vacancies.
CREATE INDEX IF NOT EXISTS idx_band_vacancies_open_created
  ON band_vacancies(band_id, created_at DESC)
  WHERE open = true;

-- Fix: posts — (user_id, created_at DESC) for "my posts" profile page queries.
CREATE INDEX IF NOT EXISTS idx_posts_user_created
  ON posts(user_id, created_at DESC);

-- Fix: reviews — (entity_type, entity_id, created_at DESC) for paginated entity review lists.
-- The existing idx_reviews_entity covers (entity_type, entity_id) but forces a separate sort.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reviews' AND table_schema='public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_entity_created ON reviews(entity_type, entity_id, created_at DESC)';
  END IF;
END $$;


-- ============= SECTION 35: Missing RLS policies =============

-- Fix: notifications — no DELETE policy exists, so users cannot dismiss/clear notifications.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Users can delete their notifications'
  ) THEN
    CREATE POLICY "Users can delete their notifications"
      ON notifications FOR DELETE
      USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- Fix: posts — no UPDATE policy. If the app ever adds post editing, owners are locked out.
-- Adding a permissive owner-only UPDATE policy now so the feature requires no schema change.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'posts' AND policyname = 'Owners can update their posts'
  ) THEN
    CREATE POLICY "Owners can update their posts"
      ON posts FOR UPDATE
      USING    (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- Fix: gear_listings SELECT policy was named "Anyone can view active listings" but the
-- USING clause is USING (true), which returns ALL listings (including sold/reserved).
-- The policy name was misleading to future reviewers; rename it to match actual behavior.
DROP POLICY IF EXISTS "Anyone can view active listings" ON gear_listings;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gear_listings' AND policyname = 'Anyone can view gear listings'
  ) THEN
    CREATE POLICY "Anyone can view gear listings"
      ON gear_listings FOR SELECT USING (true);
  END IF;
END $$;


-- ============= SECTION 36: vacancy_applications unique constraint NULL bypass =============
-- Fix: UNIQUE(vacancy_id, musician_id) from section 5 is ineffective when musician_id is NULL.
-- ON DELETE SET NULL on the musician FK means a deleted musician profile sets musician_id to NULL.
-- PostgreSQL unique constraints do not treat two NULLs as equal, so multiple users without a
-- musician profile can each apply to the same vacancy without triggering the constraint.
-- Add UNIQUE(vacancy_id, user_id) which is always non-null and correctly prevents duplicate applies.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'vacancy_applications'
      AND constraint_name = 'vacancy_applications_vacancy_id_user_id_key'
  ) THEN
    ALTER TABLE vacancy_applications
      ADD CONSTRAINT vacancy_applications_vacancy_id_user_id_key
      UNIQUE (vacancy_id, user_id);
  END IF;
END $$;


-- ============= SECTION 37: Harden create_notification — spam rate limit ======
--
-- Problem: create_notification(p_user_id => <any_uuid>) is callable by any
-- authenticated user and will insert a notification targeting anyone. There is
-- no relationship check — a malicious user could spam another user's notification
-- inbox indefinitely.
--
-- Fix: reject the call if the target user has already received ≥ 20 notifications
-- in the last hour from ANY source. Legitimate flows (vacancy application, one
-- message notification) are well below this threshold.
--
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
  recent_count INT;
BEGIN
  -- Caller must be authenticated
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Rate-limit: at most 20 notifications received by this user per rolling hour.
  SELECT COUNT(*) INTO recent_count
  FROM notifications
  WHERE user_id = p_user_id
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Notification rate limit exceeded — too many notifications sent to this user';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_entity_type, p_entity_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
