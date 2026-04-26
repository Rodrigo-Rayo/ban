-- Gear marketplace
CREATE TABLE IF NOT EXISTS gear_listings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title               text NOT NULL,
  description         text,
  price               numeric NOT NULL,
  category            text NOT NULL DEFAULT 'other',
  condition           text NOT NULL DEFAULT 'good',
  city                text,
  images              text[] DEFAULT '{}',
  status              text NOT NULL DEFAULT 'active',
  seller_name         text,
  seller_profile_type text,
  seller_profile_id   uuid,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE gear_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gear listings" ON gear_listings
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert gear" ON gear_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gear" ON gear_listings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gear" ON gear_listings
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for gear images (run in Supabase dashboard if needed)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('gear-images', 'gear-images', true)
  ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view gear images" ON storage.objects
  FOR SELECT USING (bucket_id = 'gear-images');

CREATE POLICY "Authenticated can upload gear images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gear-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own gear images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'gear-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
