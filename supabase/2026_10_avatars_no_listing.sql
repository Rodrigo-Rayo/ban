-- 2026-10-29 · 'avatars' bucket: no anonymous listing
-- ---------------------------------------------------------------------------
-- The bucket is public, so photos keep loading through /object/public/... with
-- no SELECT policy at all. Today anyone can also LIST the bucket and read every
-- user's folder name (their account id). This keeps listing only for the owner's
-- own folder (the upload uses upsert, which needs to see its own file).
-- Same treatment the 'media' bucket got in audit_2026_10_launch_hardening.sql.
--
-- Safe to run more than once. Nothing changes for photos on the web.

BEGIN;

-- Drop every SELECT policy on storage.objects that covers the avatars bucket
-- (some were created from the dashboard with generated names).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT'
      AND qual ILIKE '%avatars%'
      -- leave alone any policy shared with the other buckets
      AND qual NOT ILIKE '%gear-images%' AND qual NOT ILIKE '%media%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "avatars list own" ON storage.objects;
CREATE POLICY "avatars list own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

COMMIT;

-- ── Verificar / verify ────────────────────────────────────────────────────
--   SELECT policyname, roles, qual FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT';
--   → para avatars solo debe quedar "avatars list own".
--   Abrir cualquier perfil: las fotos se siguen viendo.
--   Cambiar tu foto de perfil: se sube bien.
