-- ═══════════════════════════════════════════════════════════════════════════
-- Pre-launch cleanup of demo/test data. IRREVERSIBLE — review the previews first.
-- Counts on 2026-10-01: 20 auth users @bandyou.test; 36 directory rows with
-- user_id IS NULL (12 musicians, 6 bands, 6 teachers, 5 rehearsal spaces, 7 events)
-- that nobody can contact (the "Mensaje" button needs an owner).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) PREVIEW — run these first and check nothing real is listed.
SELECT id, email, created_at FROM auth.users WHERE email LIKE '%@bandyou.test' ORDER BY created_at;
SELECT 'musicians' AS t, id, name FROM musicians WHERE user_id IS NULL
UNION ALL SELECT 'bands', id, name FROM bands WHERE user_id IS NULL
UNION ALL SELECT 'teachers', id, name FROM teachers WHERE user_id IS NULL
UNION ALL SELECT 'rehearsal_spaces', id, name FROM rehearsal_spaces WHERE user_id IS NULL
UNION ALL SELECT 'events', id, title FROM events WHERE user_id IS NULL;
-- Test listings/posts from real accounts (e.g. the "Cheetos" listing) must be removed by hand:
SELECT id, title, seller_name, status FROM gear_listings ORDER BY created_at;
SELECT id, left(text, 60), author_name FROM posts ORDER BY created_at;

-- 2) DELETE — uncomment after reviewing the previews.
-- BEGIN;
-- -- Ownerless seed rows
-- DELETE FROM events           WHERE user_id IS NULL;
-- DELETE FROM rehearsal_spaces WHERE user_id IS NULL;
-- DELETE FROM teachers         WHERE user_id IS NULL;
-- DELETE FROM band_members     WHERE band_id IN (SELECT id FROM bands WHERE user_id IS NULL);
-- DELETE FROM bands            WHERE user_id IS NULL;
-- DELETE FROM musicians        WHERE user_id IS NULL;
-- -- Test accounts: profile tables reference auth.users ON DELETE CASCADE.
-- DELETE FROM auth.users WHERE email LIKE '%@bandyou.test';
-- COMMIT;
