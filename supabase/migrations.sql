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
      ON rehearsal_bookings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
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
