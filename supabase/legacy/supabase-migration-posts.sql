-- Posts / Anuncios
CREATE TABLE IF NOT EXISTS posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type                text NOT NULL DEFAULT 'other',
  text                text NOT NULL,
  city                text,
  instrument          text,
  genre               text,
  author_name         text,
  author_profile_type text,
  author_profile_id   uuid,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read posts
CREATE POLICY "Anyone can read posts" ON posts
  FOR SELECT USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated users can insert posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (auth.uid() = user_id);
