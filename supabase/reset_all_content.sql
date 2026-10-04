-- ═══════════════════════════════════════════════════════════════════════════
-- Puesta a cero antes del lanzamiento (2026-10-04). IRREVERSIBLE.
-- Pedido por el titular: la web debe quedar vacía y empezar solo con contenido real.
-- Borra TODOS los perfiles (músicos, bandas, salas, profesores, locales) y todo
-- el contenido: anuncios, eventos, Tienda, vacantes, reseñas, favoritos,
-- mensajes y notificaciones.
-- NO borra las cuentas de acceso (auth.users): cada uno puede volver a entrar
-- y crear su perfil desde cero (la web le lleva al alta de perfil).
--
-- Supabase → SQL Editor: ejecuta el bloque 1 (ver qué hay), luego el 2 (borrar)
-- y el 3 (comprobar). Si sale el aviso de RLS, "Run without RLS".
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Qué hay ahora ──────────────────────────────────────────────────────
SELECT 'músico' AS que, name AS detalle FROM musicians
UNION ALL SELECT 'banda',    name  FROM bands
UNION ALL SELECT 'sala',     name  FROM venues
UNION ALL SELECT 'profesor', name  FROM teachers
UNION ALL SELECT 'local',    name  FROM rehearsal_spaces
UNION ALL SELECT 'evento',   title FROM events
UNION ALL SELECT 'tienda',   title FROM gear_listings
UNION ALL SELECT 'anuncio',  left(text, 50) FROM posts
UNION ALL SELECT 'cuenta (se conserva)', email FROM auth.users
ORDER BY 1, 2;


-- ── 2) BORRAR ─────────────────────────────────────────────────────────────
-- Children first; tables that may not exist in this database are skipped.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vacancy_applications', 'band_vacancies', 'band_members',
    'event_rsvps', 'rehearsal_bookings', 'reviews', 'favorites',
    'posts', 'gear_listings', 'events',
    'notifications', 'messages', 'conversations',
    'musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I', t);
    END IF;
  END LOOP;
END;
$$;


-- ── 3) Comprobación (todo debería dar 0 menos las cuentas) ────────────────
SELECT
  (SELECT count(*) FROM musicians)        AS musicos,
  (SELECT count(*) FROM bands)            AS bandas,
  (SELECT count(*) FROM venues)           AS salas,
  (SELECT count(*) FROM teachers)         AS profesores,
  (SELECT count(*) FROM rehearsal_spaces) AS locales,
  (SELECT count(*) FROM events)           AS eventos,
  (SELECT count(*) FROM gear_listings)    AS tienda,
  (SELECT count(*) FROM posts)            AS anuncios,
  (SELECT count(*) FROM auth.users)       AS cuentas_conservadas;
