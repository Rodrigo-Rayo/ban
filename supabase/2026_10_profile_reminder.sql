-- ═══════════════════════════════════════════════════════════════════════════
-- Recordatorio "te falta un paso" (2026-10-08). Idempotente.
--
-- A quien creó la cuenta (email confirmado) pero no terminó el perfil, le llega
-- UN solo email a las 24 h con un botón para acabarlo. Nunca más de uno por
-- persona. Cuentas de más de 30 días no reciben nada.
-- Usa la misma clave de Resend que los avisos de mensajes (vault: resend_api_key)
-- y has_profile() de 2026_10_require_profile.sql.
--
-- Supabase → SQL Editor → pegar todo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS profile_reminder_log (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profile_reminder_log ENABLE ROW LEVEL SECURITY;  -- sin políticas: nadie desde la web
REVOKE ALL ON profile_reminder_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_profile_reminders() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_key   text;
  v_sent  integer := 0;
  v_link  constant text := 'https://www.bandyou.es/dashboard';
  v_subj  constant text := 'Te falta un paso para aparecer en BandYou';
  r       record;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('send_profile_reminders')) THEN RETURN 0; END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF v_key IS NULL OR v_key = '' THEN RETURN 0; END IF;

  FOR r IN
    SELECT u.id, u.email
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL
      AND u.created_at < now() - interval '24 hours'
      AND u.created_at > now() - interval '30 days'
      AND NOT public.has_profile(u.id)
      AND NOT EXISTS (SELECT 1 FROM public.profile_reminder_log l WHERE l.user_id = u.id)
    LIMIT 50
  LOOP
    PERFORM net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'from', 'BandYou <avisos@bandyou.es>',
        'to', jsonb_build_array(r.email),
        'reply_to', 'contacto@bandyou.es',
        'subject', v_subj,
        'text', E'¡Hola!\n\nCreaste tu cuenta en BandYou pero aún no tienes perfil, así que nadie puede encontrarte todavía.'
                || E'\n\nTermínalo en un par de minutos (instrumento, estilo y zona) y empieza a aparecer en las búsquedas de bandas y músicos: '
                || v_link
                || E'\n\nSi tienes alguna duda, responde a este correo.\n\nEste es el único recordatorio que te enviaremos.',
        'html',
          '<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f2ebdd;font-family:Arial,Helvetica,sans-serif;color:#141210">'
          || '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ebdd;padding:32px 16px"><tr><td align="center">'
          || '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#faf6ee;border:2px solid #141210">'
          || '<tr><td style="padding:22px 28px;border-bottom:3px solid #141210;font-family:Impact,''Arial Black'',sans-serif;font-size:28px;letter-spacing:1px">BAND<span style="color:#c23a1f">YOU</span></td></tr>'
          || '<tr><td style="padding:28px">'
          || '<p style="margin:0 0 6px;font-family:''Courier New'',monospace;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#c23a1f">Te falta un paso</p>'
          || '<h1 style="margin:0 0 14px;font-size:24px;line-height:1.2">Aún nadie puede encontrarte</h1>'
          || '<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#3d3830">Creaste tu cuenta en BandYou, pero todavía no tienes perfil. Sin él no sales en las búsquedas ni pueden escribirte.</p>'
          || '<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#3d3830">Son un par de minutos: instrumento, estilo y zona. Luego ya apareces para las bandas y músicos de tu provincia.</p>'
          || '<a href="' || v_link || '" style="display:inline-block;background:#c23a1f;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 26px;border:2px solid #141210">Terminar mi perfil</a>'
          || '</td></tr>'
          || '<tr><td style="padding:16px 28px;border-top:1px solid #d8cfbf;font-size:12px;line-height:1.5;color:#6b6358">'
          || 'Este es el único recordatorio que te enviaremos. ¿Dudas? Responde a este correo.</td></tr>'
          || '</table></td></tr></table></body></html>'
      )
    );
    INSERT INTO public.profile_reminder_log (user_id) VALUES (r.id) ON CONFLICT (user_id) DO NOTHING;
    v_sent := v_sent + 1;
  END LOOP;
  RETURN v_sent;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_profile_reminders() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ── Cada hora ─────────────────────────────────────────────────────────────
SELECT cron.unschedule('profile-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'profile-reminders');
SELECT cron.schedule('profile-reminders', '17 * * * *', $$SELECT public.send_profile_reminders()$$);

-- Verificar:
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'profile-reminders';
--   SELECT count(*) FROM profile_reminder_log;   -- a cuántos se ha enviado ya
