-- ═══════════════════════════════════════════════════════════════════════════
-- Limpieza final antes de promocionar. IRREVERSIBLE.
-- Borra:  · cuentas de demostración  (email @bandyou.test)
--         · cuentas de pruebas de Claude (claude-prueba-…@uberip.com: "QA-TEST")
--         · filas del directorio sin dueño (user_id NULL: nadie puede contestar)
--         · el artículo de prueba "Cheetos"
-- NO toca tu cuenta (RodriR) ni Guitarreando ni ninguna otra cuenta real.
--
-- Cómo usarlo (Supabase → SQL Editor):
--   1) Ejecuta SOLO el bloque PREVIEW y revisa que no aparezca nada real.
--   2) Ejecuta el bloque BORRAR completo. Si da error, no se borra nada
--      (es una transacción): copia el error y pásamelo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) PREVIEW ─────────────────────────────────────────────────────────────
WITH doomed AS (
  SELECT id, email FROM auth.users
  WHERE email LIKE '%@bandyou.test'
     OR email IN ('claude-prueba-mups9bc5@uberip.com', 'claude-prueba-mupum3ex@uberip.com')
)
SELECT 'cuenta' AS que, email AS detalle FROM doomed
UNION ALL SELECT 'músico',  name  FROM musicians        WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed)
UNION ALL SELECT 'banda',   name  FROM bands            WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed)
UNION ALL SELECT 'sala',    name  FROM venues           WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed)
UNION ALL SELECT 'profesor',name  FROM teachers         WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed)
UNION ALL SELECT 'local',   name  FROM rehearsal_spaces WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed)
UNION ALL SELECT 'evento',  title FROM events           WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed)
UNION ALL SELECT 'tienda',  title FROM gear_listings    WHERE user_id IN (SELECT id FROM doomed) OR title ILIKE 'cheetos%'
UNION ALL SELECT 'anuncio', left(text, 50) FROM posts   WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed)
ORDER BY 1, 2;

-- Lo que QUEDA después (debería ser solo contenido real):
-- SELECT 'músico', name FROM musicians WHERE user_id IS NOT NULL
--   AND user_id NOT IN (SELECT id FROM auth.users WHERE email LIKE '%@bandyou.test' OR email LIKE 'claude-prueba-%@uberip.com')
-- UNION ALL SELECT 'banda', name FROM bands WHERE user_id IS NOT NULL
--   AND user_id NOT IN (SELECT id FROM auth.users WHERE email LIKE '%@bandyou.test' OR email LIKE 'claude-prueba-%@uberip.com');


-- ── 2) BORRAR ──────────────────────────────────────────────────────────────
BEGIN;

CREATE TEMP TABLE doomed ON COMMIT DROP AS
  SELECT id FROM auth.users
  WHERE email LIKE '%@bandyou.test'
     OR email IN ('claude-prueba-mups9bc5@uberip.com', 'claude-prueba-mupum3ex@uberip.com');

-- Contenido de esas cuentas y del directorio sin dueño
DELETE FROM vacancy_applications WHERE vacancy_id IN (
  SELECT v.id FROM band_vacancies v JOIN bands b ON b.id = v.band_id
  WHERE b.user_id IS NULL OR b.user_id IN (SELECT id FROM doomed));
DELETE FROM vacancy_applications WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM band_vacancies WHERE band_id IN (SELECT id FROM bands WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed));
DELETE FROM band_members   WHERE band_id IN (SELECT id FROM bands WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed));
DELETE FROM favorites      WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM reviews        WHERE user_id IN (SELECT id FROM doomed);
DELETE FROM posts          WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed);
DELETE FROM gear_listings  WHERE user_id IN (SELECT id FROM doomed) OR title ILIKE 'cheetos%';
DELETE FROM events         WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed);
DELETE FROM musicians        WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed);
DELETE FROM bands            WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed);
DELETE FROM venues           WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed);
DELETE FROM teachers         WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed);
DELETE FROM rehearsal_spaces WHERE user_id IS NULL OR user_id IN (SELECT id FROM doomed);

-- Las cuentas (mensajes, notificaciones, perfiles, suscripciones… caen en cascada)
DELETE FROM auth.users WHERE id IN (SELECT id FROM doomed);

COMMIT;

-- ── 3) Comprobación ────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM musicians)        AS musicos,
  (SELECT count(*) FROM bands)            AS bandas,
  (SELECT count(*) FROM venues)           AS salas,
  (SELECT count(*) FROM teachers)         AS profesores,
  (SELECT count(*) FROM rehearsal_spaces) AS locales,
  (SELECT count(*) FROM events)           AS eventos,
  (SELECT count(*) FROM gear_listings)    AS tienda,
  (SELECT count(*) FROM posts)            AS anuncios;
