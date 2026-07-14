import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @deno-types="https://esm.sh/web-push@3.6.7/src/index.d.ts"
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY =
  'BLslfW3Qj79wALOTHJX4VV9sSDuqr1U8kjL3I4NtyB7zCats8W_qTmZNAKMD8ku44dpen2KORGtfd2fTGG3RDLs';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!vapidPrivateKey) {
      return new Response('VAPID_PRIVATE_KEY not configured', { status: 500 });
    }

    webpush.setVapidDetails(
      'mailto:rodrigorayo12@gmail.com',
      VAPID_PUBLIC_KEY,
      vapidPrivateKey,
    );

    const { conversationId, senderId, senderName, messageText } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: conv } = await supabase
      .from('conversations')
      .select('user1_id, user2_id')
      .eq('id', conversationId)
      .single();

    if (!conv) return new Response('conversation not found', { status: 404 });

    const recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipientId);

    if (!subs?.length) return new Response('no subscriptions', { status: 200 });

    const body = messageText.length > 100 ? messageText.slice(0, 97) + '...' : messageText;

    const payload = JSON.stringify({
      notification: {
        title: senderName || 'Bandyou',
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: { url: `/chat/${conversationId}` },
      },
    });

    await Promise.allSettled(
      subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      ),
    );

    return new Response('ok', {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('send-push error:', err);
    return new Response('error', { status: 500 });
  }
});
