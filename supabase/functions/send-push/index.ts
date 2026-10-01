import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// VAPID public key is intentionally public — safe to hard-code here.
const VAPID_PUBLIC_KEY =
  'BLslfW3Qj79wALOTHJX4VV9sSDuqr1U8kjL3I4NtyB7zCats8W_qTmZNAKMD8ku44dpen2KORGtfd2fTGG3RDLs';

// Allow the production origin plus localhost for local dev/testing.
const ALLOWED_ORIGINS = new Set([
  'https://bandyou.es',
  'https://www.bandyou.es',
  'http://localhost:4200',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 60;
const MAX_BODY_LENGTH = 120;
/** Only messages this fresh can trigger a push (stops replaying old message ids). */
const MAX_MESSAGE_AGE_MS = 2 * 60 * 1000;
/**
 * Per-sender cooldown per conversation: at most one push per window, measured from
 * the last push actually sent (messages.push_sent_at). A burst still yields a push
 * every window instead of only the first message.
 */
const SENDER_COOLDOWN_MS = 5 * 1000;
/** Best-effort in-isolate dedupe of message ids already pushed (isolates are ephemeral). */
const pushedMessageIds = new Map<string, number>();

// Only real browser push services: a user-registered endpoint must not make this
// function send requests to arbitrary hosts (SSRF).
const PUSH_HOSTS = [
  /(^|\.)googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /(^|\.)push\.apple\.com$/,
];

function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some(re => re.test(url.hostname));
  } catch {
    return false;
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function alreadyPushed(messageId: string): boolean {
  const now = Date.now();
  for (const [id, at] of pushedMessageIds) {
    if (now - at > MAX_MESSAGE_AGE_MS) pushedMessageIds.delete(id);
  }
  if (pushedMessageIds.has(messageId)) return true;
  pushedMessageIds.set(messageId, now);
  return false;
}

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://bandyou.es';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  try {
    // --- 1. Authenticate the caller ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
    }

    // Verify JWT and get the authenticated user's id.
    // Use SUPABASE_ANON_KEY + user's token so auth.getUser() runs the JWT check.
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      console.error('[send-push] invalid JWT:', authErr?.message);
      return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
    }

    // --- 2. Parse and validate request body ---
    // Only ids are accepted from the client. senderName / messageText sent by
    // older clients are ignored: both are derived server-side from the stored row.
    if (Number(req.headers.get('Content-Length') ?? 0) > 4096) {
      return new Response('Payload too large', { status: 413, headers: corsHeaders(origin) });
    }
    let body: Record<string, unknown> | null;
    try {
      body = await req.json();
    } catch {
      return new Response('Bad request', { status: 400, headers: corsHeaders(origin) });
    }
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : '';
    const messageId = typeof body?.messageId === 'string' ? body.messageId : null;
    const claimedSender = body?.senderId;

    if (claimedSender !== undefined && claimedSender !== user.id) {
      console.error('[send-push] senderId mismatch');
      return new Response('Forbidden', { status: 403, headers: corsHeaders(origin) });
    }
    if (!UUID_RE.test(conversationId) || (messageId !== null && !UUID_RE.test(messageId))) {
      return new Response('Bad request', { status: 400, headers: corsHeaders(origin) });
    }

    // --- 3. Set up VAPID / push ---
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPrivateKey) {
      console.error('[send-push] VAPID_PRIVATE_KEY not set');
      return new Response('VAPID_PRIVATE_KEY not configured', { status: 500, headers: corsHeaders(origin) });
    }

    webpush.setVapidDetails(
      Deno.env.get('VAPID_CONTACT_EMAIL') ?? 'mailto:soporte@bandyou.es',
      VAPID_PUBLIC_KEY,
      vapidPrivateKey,
    );

    // Service-role client for privileged lookups (conversation / subscriptions).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- 4. Look up conversation and verify sender is a participant ---
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (convErr || !conv) {
      console.error('[send-push] conversation not found:', convErr?.message);
      return new Response('conversation not found', { status: 404, headers: corsHeaders(origin) });
    }

    // Confirm the authenticated user is in this conversation.
    if (conv.user1_id !== user.id && conv.user2_id !== user.id) {
      console.error('[send-push] caller is not a participant');
      return new Response('Forbidden', { status: 403, headers: corsHeaders(origin) });
    }

    const recipientId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;

    // --- 4b. Load the stored message (never trust client-supplied text) ---
    // Legacy clients don't send messageId: fall back to the caller's latest message.
    const msgQuery = supabase
      .from('messages')
      .select('id, sender_id, conversation_id, text, created_at')
      .eq('conversation_id', conversationId)
      .eq('sender_id', user.id);
    const { data: message, error: msgErr } = messageId
      ? await msgQuery.eq('id', messageId).maybeSingle()
      : await msgQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (msgErr || !message) {
      console.error('[send-push] message not found:', msgErr?.message);
      return new Response('message not found', { status: 404, headers: corsHeaders(origin) });
    }

    const createdAt = new Date(message.created_at).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > MAX_MESSAGE_AGE_MS) {
      return new Response('message too old', { status: 200, headers: corsHeaders(origin) });
    }
    if (alreadyPushed(message.id)) {
      return new Response('already sent', { status: 200, headers: corsHeaders(origin) });
    }

    // Per-sender cooldown: skip if this sender already triggered a push in this thread recently.
    // Errors (e.g. push_sent_at not migrated yet) disable the cooldown rather than the push.
    const { count: recentCount, error: recentErr } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('sender_id', user.id)
      .neq('id', message.id)
      .gte('push_sent_at', new Date(Date.now() - SENDER_COOLDOWN_MS).toISOString());
    if (recentErr) console.error('[send-push] cooldown query error:', recentErr.message);
    if ((recentCount ?? 0) > 0) {
      return new Response('cooldown', { status: 200, headers: corsHeaders(origin) });
    }

    // Durable exactly-once claim (survives isolate restarts). If the push_sent_at
    // column is not migrated yet, fall back to the in-isolate dedupe above.
    const { data: claimed, error: claimErr } = await supabase
      .from('messages')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', message.id)
      .is('push_sent_at', null)
      .select('id');
    if (claimErr) {
      console.error('[send-push] push_sent_at claim skipped:', claimErr.message);
    } else if (!claimed?.length) {
      return new Response('already sent', { status: 200, headers: corsHeaders(origin) });
    }

    const { data: profileName, error: nameErr } = await supabase
      .rpc('get_profile_name', { p_user_id: user.id });
    if (nameErr) console.error('[send-push] name lookup error:', nameErr.message);
    const senderName = typeof profileName === 'string' && profileName.trim()
      ? truncate(profileName, MAX_TITLE_LENGTH)
      : 'Bandyou';
    const text = truncate(String(message.text ?? ''), MAX_BODY_LENGTH) || 'Nuevo mensaje';

    // --- 5. Fetch subscriptions and dispatch ---
    const { data: allSubs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipientId);
    const subs = (allSubs ?? []).filter((sub: { endpoint: string }) => isPushEndpoint(sub.endpoint));

    if (subsErr) console.error('[send-push] subs query error:', subsErr.message);

    if (!subs?.length) {
      console.log('[send-push] no subscriptions for recipient');
      return new Response('no subscriptions', { status: 200, headers: corsHeaders(origin) });
    }

    console.log('[send-push] sending to', subs.length, 'subscription(s)');

    const payload = JSON.stringify({
      notification: {
        title: senderName,
        body: text,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // Collapse a burst of messages from one thread into a single notification.
        tag: `conversation-${conversationId}`,
        renotify: true,
        data: {
          url: `/inbox/${conversationId}`,
          onActionClick: {
            default: {
              operation: 'navigateLastFocusedOrOpen',
              url: `/inbox/${conversationId}`,
            },
          },
        },
      },
    });

    const results = await Promise.allSettled(
      subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60, urgency: 'high' },
        )
      ),
    );

    // Clean up expired/revoked subscriptions (HTTP 410 Gone or 404 Not Found)
    const expiredEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`[send-push] sub[${i}] sent ok`);
      } else {
        const status = (r.reason as any)?.statusCode ?? (r.reason as any)?.status;
        console.error(`[send-push] sub[${i}] failed (${status}):`, r.reason?.message ?? r.reason);
        if (status === 410 || status === 404) {
          expiredEndpoints.push(subs[i].endpoint);
        }
      }
    });

    if (expiredEndpoints.length > 0) {
      const { error: deleteErr } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', recipientId)
        .in('endpoint', expiredEndpoints);
      if (deleteErr) {
        console.error('[send-push] failed to delete expired subs:', deleteErr.message);
      } else {
        console.log('[send-push] cleaned', expiredEndpoints.length, 'expired subscription(s)');
      }
    }

    return new Response('ok', { status: 200, headers: corsHeaders(origin) });
  } catch (err) {
    console.error('[send-push] unexpected error:', err);
    return new Response('error', { status: 500, headers: corsHeaders(origin) });
  }
});
