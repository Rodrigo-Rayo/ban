import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY =
  'BLslfW3Qj79wALOTHJX4VV9sSDuqr1U8kjL3I4NtyB7zCats8W_qTmZNAKMD8ku44dpen2KORGtfd2fTGG3RDLs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPrivateKey) {
      console.error('[send-push] VAPID_PRIVATE_KEY not set');
      return new Response('VAPID_PRIVATE_KEY not configured', { status: 500 });
    }

    webpush.setVapidDetails(
      'mailto:rodrigorayo12@gmail.com',
      VAPID_PUBLIC_KEY,
      vapidPrivateKey,
    );

    const body = await req.json();
    const { conversationId, senderId, senderName, messageText } = body;
    console.log('[send-push] request:', { conversationId, senderId, senderName });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      console.error('[send-push] conversation not found:', convErr?.message);
      return new Response('conversation not found', { status: 404 });
    }

    const recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
    console.log('[send-push] recipient:', recipientId);

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipientId);

    if (subsErr) console.error('[send-push] subs query error:', subsErr.message);

    if (!subs?.length) {
      console.log('[send-push] no subscriptions for recipient');
      return new Response('no subscriptions', { status: 200, headers: corsHeaders });
    }

    console.log('[send-push] sending to', subs.length, 'subscription(s)');

    const text = messageText.length > 100 ? messageText.slice(0, 97) + '...' : messageText;

    const payload = JSON.stringify({
      notification: {
        title: senderName || 'Bandyou',
        body: text,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
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
        .in('endpoint', expiredEndpoints);
      if (deleteErr) {
        console.error('[send-push] failed to delete expired subs:', deleteErr.message);
      } else {
        console.log('[send-push] cleaned', expiredEndpoints.length, 'expired subscription(s)');
      }
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[send-push] unexpected error:', err);
    return new Response('error', { status: 500, headers: corsHeaders });
  }
});
