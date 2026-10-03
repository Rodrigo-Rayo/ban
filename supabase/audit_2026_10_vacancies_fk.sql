-- ═══════════════════════════════════════════════════════════════════════════
-- band_vacancies.band_id has no foreign key to bands in the live schema, so
-- PostgREST cannot embed bands <-> band_vacancies (PGRST200). The app now joins
-- in two queries (VacanciesService), but the FK also keeps data consistent:
-- vacancies of a deleted band are removed with it.
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Orphans that would block the constraint (review before deleting).
SELECT v.id, v.band_id, v.instrument
FROM band_vacancies v
LEFT JOIN bands b ON b.id = v.band_id
WHERE b.id IS NULL;

DELETE FROM band_vacancies v
WHERE NOT EXISTS (SELECT 1 FROM bands b WHERE b.id = v.band_id);

-- 2) The constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'band_vacancies_band_id_fkey'
  ) THEN
    ALTER TABLE band_vacancies
      ADD CONSTRAINT band_vacancies_band_id_fkey
      FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS band_vacancies_band_id_idx ON band_vacancies (band_id);

-- 3) Make PostgREST pick up the new relationship.
NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) Band owners can dismiss ("Descartar") applications to their own vacancies.
--    Today only the applicant can delete. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Band owner can dismiss applications" ON vacancy_applications;
CREATE POLICY "Band owner can dismiss applications" ON vacancy_applications
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM band_vacancies bv
      JOIN bands b ON b.id = bv.band_id
      WHERE bv.id = vacancy_applications.vacancy_id
        AND b.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) Deleting a vacancy removes its applications. The live FK
--    vacancy_applications.vacancy_id → band_vacancies has no ON DELETE CASCADE,
--    so a band owner deleting a vacancy with applicants gets HTTP 409.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE rel.relname = 'vacancy_applications' AND con.contype = 'f' AND att.attname = 'vacancy_id'
  LOOP
    EXECUTE format('ALTER TABLE vacancy_applications DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE vacancy_applications
    ADD CONSTRAINT vacancy_applications_vacancy_id_fkey
    FOREIGN KEY (vacancy_id) REFERENCES band_vacancies(id) ON DELETE CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';
