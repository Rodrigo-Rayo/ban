// Vercel serverless function: link previews for shared pages.
// WhatsApp, Telegram, Facebook, X, LinkedIn… do not run JavaScript, so a shared
// /musicians/:id link would always show the generic card. vercel.json rewrites
// detail URLs here ONLY for crawler user agents; people still get the static SPA.
// It returns the built index.html with title, description, image and canonical
// filled in for that page (and a real 404 status for unknown ids).

const SITE = 'https://www.bandyou.es';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yxaurffzwtqsckfmnzdj.supabase.co';
// The anon key is public by design (it ships in the frontend bundle); env var overrides it.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXVyZmZ6d3Rxc2NrZm1uemRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTE2ODIsImV4cCI6MjA5MjI4NzY4Mn0.GUbfyBpaP8W_LFIT9IfMjuszgw-J87ANhOAJY8Tpj1E';
const DEFAULT_IMAGE = `${SITE}/og-default.jpg`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const POST_LABELS = {
  musician_seeking_band: 'Busca banda', band_seeking_musician: 'Busca músico', collab: 'Busca colaboración',
  looking_for_rehearsal: 'Busca local', session_offer: 'Ofrece sesiones', event_announcement: 'Concierto',
  gear_sale: 'Vende equipo', other: 'Anuncio',
};

/** Per route: table, columns, and how a row becomes a preview. */
const TYPES = {
  musicians: {
    table: 'musicians', cols: 'name,instrument,city,description,avatar_url',
    meta: r => ({ title: r.name, kicker: [r.instrument, r.city].filter(Boolean).join(' · '), text: r.description, image: r.avatar_url }),
  },
  bands: {
    table: 'bands', cols: 'name,genre,city,description,avatar_url',
    meta: r => ({ title: r.name, kicker: ['Banda', r.genre, r.city].filter(Boolean).join(' · '), text: r.description, image: r.avatar_url }),
  },
  venues: {
    table: 'venues', cols: 'name,city,capacity,description,avatar_url,photos',
    meta: r => ({ title: r.name, kicker: ['Sala', r.city, r.capacity ? `${r.capacity} personas` : ''].filter(Boolean).join(' · '), text: r.description, image: (r.photos || [])[0] || r.avatar_url }),
  },
  teachers: {
    table: 'teachers', cols: 'name,instrument,city,description,avatar_url',
    meta: r => ({ title: r.name, kicker: ['Clases', r.instrument, r.city].filter(Boolean).join(' · '), text: r.description, image: r.avatar_url }),
  },
  rehearsal: {
    table: 'rehearsal_spaces', cols: 'name,city,hourly_rate,description,avatar_url,photos',
    meta: r => ({ title: r.name, kicker: ['Local de ensayo', r.city, r.hourly_rate ? `${r.hourly_rate} €/h` : ''].filter(Boolean).join(' · '), text: r.description, image: (r.photos || [])[0] || r.avatar_url }),
  },
  events: {
    table: 'events', cols: 'title,venue,city,date,description,image_url',
    meta: r => ({ title: r.title, kicker: [formatDate(r.date), r.venue, r.city].filter(Boolean).join(' · '), text: r.description, image: r.image_url, type: 'article' }),
  },
  shop: {
    table: 'gear_listings', cols: 'title,price,city,description,images',
    meta: r => ({ title: r.title, kicker: [r.price ? `${r.price} €` : '', r.city].filter(Boolean).join(' · '), text: r.description, image: (r.images || [])[0], type: 'product' }),
  },
  posts: {
    table: 'posts', cols: 'type,text,city,author_name',
    meta: r => ({ title: `${r.author_name}: ${(POST_LABELS[r.type] || 'Anuncio').toLowerCase()}`, kicker: ['Se busca', r.city].filter(Boolean).join(' · '), text: r.text }),
  },
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : '';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

/** Only images we host (Supabase storage) or our own site; anything else falls back to the default card. */
function safeImage(url) {
  return typeof url === 'string' && (url.startsWith(`${SUPABASE_URL}/storage/`) || url.startsWith(SITE)) ? url : DEFAULT_IMAGE;
}

async function fetchRow(type, id) {
  const def = TYPES[type];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${def.table}?select=${def.cols}&id=eq.${id}&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`${def.table}: HTTP ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

/** Replaces the content of an existing tag in index.html (or the whole tag), leaving everything else as built. */
function setMeta(html, { title, description, url, image, type, noindex }) {
  const t = escapeHtml(title), d = escapeHtml(description), u = escapeHtml(url), i = escapeHtml(image);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${t}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta property="og:type" content=")[^"]*/, `$1${type || 'profile'}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${u}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${i}`)
    .replace(/\s*<meta property="og:image:(width|height)" content="\d+">/g, image === DEFAULT_IMAGE ? '$&' : '')
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${t}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta name="twitter:image" content=")[^"]*/, `$1${i}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${u}`)
    .replace(/(<meta name="robots" content=")[^"]*/, noindex ? '$1noindex' : '$1index,follow,max-image-preview:large');
}

module.exports = async function handler(req, res) {
  const type = String(req.query.type || '');
  const id = String(req.query.id || '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.bandyou.es';

  let html;
  try {
    const shell = await fetch(`https://${host}/index.html`);
    html = await shell.text();
  } catch (err) {
    console.error('[share] index.html', err?.message);
    res.statusCode = 302;
    res.setHeader('Location', `${SITE}/`);
    return res.end();
  }

  const url = `${SITE}/${type}/${id}`;
  let row = null;
  if (TYPES[type] && UUID.test(id)) {
    try { row = await fetchRow(type, id); } catch (err) { console.error('[share]', err?.message); }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!row) {
    res.statusCode = 404;
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.end(setMeta(html, { title: 'Página no encontrada · BandYou', description: 'Este contenido ya no está disponible en BandYou.', url, image: DEFAULT_IMAGE, noindex: true }));
  }

  const m = TYPES[type].meta(row);
  const description = clip([m.kicker, m.text].filter(Boolean).join(' — ') || 'En BandYou, la red musical de España.', 200);
  res.statusCode = 200;
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.end(setMeta(html, { title: `${clip(m.title, 70)} · BandYou`, description, url, image: safeImage(m.image), type: m.type }));
};
