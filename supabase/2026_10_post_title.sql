-- ═══════════════════════════════════════════════════════════════════════════
-- Título en los anuncios de Se busca (2026-10-04). Idempotente.
-- Columna opcional en la base de datos: los anuncios antiguos se quedan sin
-- título y se siguen mostrando como antes (con el nombre del autor). La web
-- lo pide como obligatorio en los anuncios nuevos (máx. 60 caracteres).
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_title_len;
ALTER TABLE posts ADD CONSTRAINT posts_title_len CHECK (title IS NULL OR char_length(title) <= 80) NOT VALID;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar: SELECT id, title, left(text, 40) FROM posts ORDER BY created_at DESC LIMIT 5;
