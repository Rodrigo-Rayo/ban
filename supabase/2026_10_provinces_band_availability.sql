-- ═══════════════════════════════════════════════════════════════════════════
-- Provincias + disponibilidad de bandas (2026-10-04). Idempotente.
--
-- 1) El selector de "ciudad" pasa a ser la lista de las 50 provincias + Ceuta y
--    Melilla. Las ciudades antiguas que no coinciden con su provincia se
--    convierten: Bilbao → Vizcaya, San Sebastián → Guipúzcoa,
--    Pamplona → Navarra, Palma → Islas Baleares. El resto (Madrid, Sevilla,
--    Valencia…) ya se llama igual que su provincia.
-- 2) Bandas: cuándo ensayan (días y franjas) y si aceptan bolos.
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Ciudades antiguas → provincia ─────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['musicians', 'bands', 'venues', 'teachers', 'rehearsal_spaces',
                           'events', 'posts', 'gear_listings'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t AND column_name = 'city') THEN
      EXECUTE format($f$
        UPDATE public.%I SET city = CASE city
          WHEN 'Bilbao'        THEN 'Vizcaya'
          WHEN 'San Sebastián' THEN 'Guipúzcoa'
          WHEN 'Pamplona'      THEN 'Navarra'
          WHEN 'Palma'         THEN 'Islas Baleares'
        END
        WHERE city IN ('Bilbao', 'San Sebastián', 'Pamplona', 'Palma')$f$, t);
    END IF;
  END LOOP;
END;
$$;

-- ── 2) Disponibilidad de bandas ──────────────────────────────────────────
ALTER TABLE bands ADD COLUMN IF NOT EXISTS rehearsal_days  text;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS rehearsal_slots text;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS open_to_gigs    boolean NOT NULL DEFAULT false;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificar ─────────────────────────────────────────────────────────────
--   SELECT city, count(*) FROM musicians GROUP BY 1 ORDER BY 2 DESC;
--   SELECT rehearsal_days, rehearsal_slots, open_to_gigs FROM bands LIMIT 1;
