-- ═══════════════════════════════════════════════════════════════════════════
-- Dirección de los eventos (2026-10-06). Idempotente.
-- Columna opcional: los eventos que ya existen se quedan sin dirección y la
-- ficha sigue ofreciendo "Cómo llegar" con el nombre de la sala y la provincia.
-- La web detecta la columna sola (MediaFeaturesService → 'eventAddress').
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE events ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_address_len;
ALTER TABLE events ADD CONSTRAINT events_address_len CHECK (address IS NULL OR char_length(address) <= 160) NOT VALID;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verificar: SELECT id, venue, address, city FROM events ORDER BY created_at DESC LIMIT 5;
