-- ═══════════════════════════════════════════════════════════════════════════
-- Avisos por email de mensajes nuevos (2026-10-06). Idempotente.
--
-- Cada 10 minutos la base de datos busca mensajes sin leer de hace más de
-- 10 minutos (si la persona estaba conectada, ya los habrá leído y no se envía
-- nada) y manda UN email por conversación con un botón "Leer y responder".
--   - Como mucho un email por conversación cada 12 horas.
--   - No incluye el texto del mensaje, solo quién te ha escrito.
--   - Cada persona puede desactivarlo en Mi panel (notification_prefs).
--   - Usa la misma cuenta de Resend que los emails de la cuenta.
--
-- ANTES DE EJECUTAR (una sola vez):
--   1. Supabase → Database → Extensions: activa "pg_net" (pg_cron ya está activo).
--   2. Resend → API Keys → Create API key (permiso "Sending access", dominio bandyou.es).
--   3. Supabase → SQL Editor, ejecuta esto con TU clave (no la compartas con nadie):
--        SELECT vault.create_secret('re_TU_CLAVE', 'resend_api_key');
--      Si ya existe y quieres cambiarla:
--        SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name = 'resend_api_key'), 're_NUEVA');
--   Sin la clave el envío no hace nada (no falla).
--
-- Después: Supabase → SQL Editor → pegar todo este archivo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_net;

BEGIN;

-- ── Preferencias (solo las ve y cambia cada uno) ────────────────────────────
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_messages  boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_prefs own read"   ON notification_prefs;
DROP POLICY IF EXISTS "notification_prefs own insert" ON notification_prefs;
DROP POLICY IF EXISTS "notification_prefs own update" ON notification_prefs;
CREATE POLICY "notification_prefs own read"   ON notification_prefs FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "notification_prefs own insert" ON notification_prefs FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "notification_prefs own update" ON notification_prefs FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE ALL ON notification_prefs FROM anon;
GRANT SELECT, INSERT, UPDATE ON notification_prefs TO authenticated;

-- ── Control de envíos ─────────────────────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_email_pending_idx
  ON messages (created_at) WHERE read = false AND email_sent_at IS NULL;

CREATE TABLE IF NOT EXISTS message_email_log (
  recipient_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_id, conversation_id)
);
ALTER TABLE message_email_log ENABLE ROW LEVEL SECURITY;  -- sin políticas: nadie desde la web
REVOKE ALL ON message_email_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.html_escape(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT replace(replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;

-- ── Envío ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_message_emails() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_key   text;
  v_sent  integer := 0;
  v_name  text;
  v_link  text;
  v_subj  text;
  r       record;
BEGIN
  -- One run at a time (cron and a manual call must not both mail the same messages).
  IF NOT pg_try_advisory_xact_lock(hashtext('send_message_emails')) THEN RETURN 0; END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;
  IF v_key IS NULL OR v_key = '' THEN RETURN 0; END IF;

  FOR r IN
    WITH pending AS (
      SELECT m.conversation_id,
             m.sender_id,
             CASE WHEN c.user1_id = m.sender_id THEN c.user2_id ELSE c.user1_id END AS recipient_id,
             max(CASE WHEN c.user1_id = m.sender_id THEN c.user1_name ELSE c.user2_name END) AS sender_name,
             count(*) AS n
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.read = false
        AND m.email_sent_at IS NULL
        AND m.created_at < now() - interval '10 minutes'
        AND m.created_at > now() - interval '2 days'
      GROUP BY m.conversation_id, m.sender_id, 3
    )
    SELECT p.*, u.email
    FROM pending p
    JOIN auth.users u ON u.id = p.recipient_id
    LEFT JOIN public.notification_prefs np ON np.user_id = p.recipient_id
    WHERE coalesce(np.email_messages, true)
      AND u.email IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.message_email_log l
        WHERE l.recipient_id = p.recipient_id AND l.conversation_id = p.conversation_id
          AND l.sent_at > now() - interval '12 hours')
    LIMIT 50
  LOOP
    v_name := left(coalesce(nullif(btrim(r.sender_name), ''), 'Alguien'), 40);
    v_link := 'https://www.bandyou.es/inbox/' || r.conversation_id;
    v_subj := CASE WHEN r.n > 1
                THEN v_name || ' te ha enviado ' || r.n || ' mensajes en BandYou'
                ELSE v_name || ' te ha escrito en BandYou' END;

    PERFORM net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'from', 'BandYou <avisos@bandyou.es>',
        'to', jsonb_build_array(r.email),
        'reply_to', 'contacto@bandyou.es',
        'headers', jsonb_build_object('List-Unsubscribe', '<https://www.bandyou.es/dashboard>'),
        'subject', left(v_subj, 120),
        'text', v_subj || E'.\n\nLéelo y responde aquí: ' || v_link
                || E'\n\nPuedes desactivar estos avisos en Mi panel: https://www.bandyou.es/dashboard',
        'html',
          '<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f2ebdd;font-family:Arial,Helvetica,sans-serif;color:#141210">'
          || '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ebdd;padding:32px 16px"><tr><td align="center">'
          || '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#faf6ee;border:2px solid #141210">'
          || '<tr><td style="padding:22px 28px;border-bottom:3px solid #141210;font-family:Impact,''Arial Black'',sans-serif;font-size:28px;letter-spacing:1px">BAND<span style="color:#c23a1f">YOU</span></td></tr>'
          || '<tr><td style="padding:28px">'
          || '<p style="margin:0 0 6px;font-family:''Courier New'',monospace;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#c23a1f">Mensaje nuevo</p>'
          || '<h1 style="margin:0 0 14px;font-size:24px;line-height:1.2">' || public.html_escape(v_subj) || '</h1>'
          || '<p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#3d3830">Entra para leerlo y contestar. Cuanto antes respondas, más fácil es cerrar el ensayo, la banda o el bolo.</p>'
          || '<a href="' || v_link || '" style="display:inline-block;background:#c23a1f;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 26px;border:2px solid #141210">Leer y responder</a>'
          || '</td></tr>'
          || '<tr><td style="padding:16px 28px;border-top:1px solid #d8cfbf;font-size:12px;line-height:1.5;color:#6b6358">'
          || 'Te avisamos porque tienes mensajes sin leer en BandYou. Puedes desactivar estos emails en '
          || '<a href="https://www.bandyou.es/dashboard" style="color:#6b6358">Mi panel</a>.</td></tr>'
          || '</table></td></tr></table></body></html>'
      )
    );

    INSERT INTO public.message_email_log (recipient_id, conversation_id, sent_at)
    VALUES (r.recipient_id, r.conversation_id, now())
    ON CONFLICT (recipient_id, conversation_id) DO UPDATE SET sent_at = excluded.sent_at;

    UPDATE public.messages SET email_sent_at = now()
    WHERE conversation_id = r.conversation_id AND sender_id = r.sender_id
      AND read = false AND email_sent_at IS NULL;

    v_sent := v_sent + 1;
  END LOOP;
  RETURN v_sent;
END $$;
REVOKE EXECUTE ON FUNCTION public.send_message_emails() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ── Programar cada 10 minutos ─────────────────────────────────────────────
SELECT cron.unschedule('message-emails') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'message-emails');
SELECT cron.schedule('message-emails', '*/10 * * * *', $$SELECT public.send_message_emails()$$);

NOTIFY pgrst, 'reload schema';

-- Verificar (haz la primera prueba con una cuenta tuya: escríbete desde otra y no lo leas):
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'message-emails';
--   SELECT public.send_message_emails();                       -- nº de emails enviados ahora
--   SELECT status_code, left(content::text, 200) FROM net._http_response ORDER BY created DESC LIMIT 5;  -- 200 = Resend lo aceptó
