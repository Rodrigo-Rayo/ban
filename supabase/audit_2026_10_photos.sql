-- ═══════════════════════════════════════════════════════════════════════════
-- Fotos: cartel de evento + galería de salas y locales de ensayo.
-- Photos: event poster + venue / rehearsal-space gallery. Idempotent.
--
-- La app detecta estas columnas una vez por sesión (MediaFeaturesService):
-- hasta que se ejecute este archivo, toda la interfaz de fotos queda oculta y
-- las consultas no piden las columnas nuevas. Tras ejecutarlo, basta recargar.
-- The app feature-detects these columns once per session: until this runs,
-- every photo UI stays hidden and no query mentions the new columns.
--
-- Rutas de subida / upload paths (bucket 'media'):
--   `${uid}/events/<timestamp>-<rand>.<ext>`  (cartel del evento)
--   `${uid}/spaces/<timestamp>-<rand>.<ext>`  (fotos del espacio, máx. 6)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Columnas / columns ─────────────────────────────────────────────────
ALTER TABLE events           ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE venues           ADD COLUMN IF NOT EXISTS photos    TEXT[] DEFAULT '{}';
ALTER TABLE rehearsal_spaces ADD COLUMN IF NOT EXISTS photos    TEXT[] DEFAULT '{}';

-- Máximo 6 fotos por espacio, también en servidor (la app ya lo limita).
-- At most 6 photos per space, enforced server side too.
ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_photos_max6;
ALTER TABLE venues ADD CONSTRAINT venues_photos_max6
  CHECK (photos IS NULL OR cardinality(photos) <= 6) NOT VALID;
ALTER TABLE rehearsal_spaces DROP CONSTRAINT IF EXISTS rehearsal_spaces_photos_max6;
ALTER TABLE rehearsal_spaces ADD CONSTRAINT rehearsal_spaces_photos_max6
  CHECK (photos IS NULL OR cardinality(photos) <= 6) NOT VALID;

-- ── 2) Bucket público 'media' / public bucket ─────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 3) Políticas de storage.objects / storage policies ───────────────────
-- Lectura pública; escritura solo dentro de la carpeta del propio usuario.
-- Public read; writes only inside the caller's own folder.
DROP POLICY IF EXISTS "media public read" ON storage.objects;
CREATE POLICY "media public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media insert own" ON storage.objects;
CREATE POLICY "media insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "media update own" ON storage.objects;
CREATE POLICY "media update own" ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "media delete own" ON storage.objects;
CREATE POLICY "media delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

COMMIT;

-- ── 4) PostgREST recarga el esquema / reload schema ──────────────────────
NOTIFY pgrst, 'reload schema';

-- ── Nota: delete_user_account ─────────────────────────────────────────────
-- La versión del repo (migrations.sql, sección 30) borra objetos de 'avatars'
-- y 'gear-images' con DELETE directo sobre storage.objects. No se redefine aquí
-- para no pisar la versión viva. Si se quiere limpiar también 'media', añadir:
--   DELETE FROM storage.objects WHERE bucket_id = 'media' AND owner = uid;
-- (ojo: los proyectos Supabase recientes bloquean el DELETE directo en
-- storage.objects; en ese caso hay que borrar vía Storage API / Edge Function).
-- Not redefined here to avoid overwriting the live function; see note above.

-- ── Verificar / verify ────────────────────────────────────────────────────
--   GET /rest/v1/events?select=image_url&limit=1  → 200 (antes: 400, code 42703)
--   GET /rest/v1/venues?select=photos&limit=1     → 200
--   GET /rest/v1/rehearsal_spaces?select=photos&limit=1 → 200
