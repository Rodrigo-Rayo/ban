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
  gear_sale: 'Vende equipo', shared_bill: 'Busca bandas', other: 'Anuncio',
};

/** Per route: table, columns, and how a row becomes a preview. */
const TYPES = {
  musicians: {
    table: 'musicians', cols: 'name,instrument,genre,city,description,avatar_url',
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
    // `title` only exists after supabase/2026_10_post_title.sql: fetchRow retries without it.
    table: 'posts', cols: 'type,text,city,author_name', optionalCols: 'title',
    meta: r => ({ title: r.title || `${r.author_name}: ${(POST_LABELS[r.type] || 'Anuncio').toLowerCase()}`, kicker: ['Se busca', r.author_name, r.city].filter(Boolean).join(' · '), text: r.text }),
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
  const get = cols => fetch(`${SUPABASE_URL}/rest/v1/${def.table}?select=${cols}&id=eq.${id}&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  let res = await get(def.optionalCols ? `${def.cols},${def.optionalCols}` : def.cols);
  // 400 = an optional column does not exist yet in this database.
  if (res.status === 400 && def.optionalCols) res = await get(def.cols);
  if (!res.ok) throw new Error(`${def.table}: HTTP ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

// Province slug for the "more in <province>" link of each page type (api/hub.js pages).
const HUB_FOR = { musicians: 'busco-musicos', bands: 'busco-banda', venues: 'salas-de-conciertos', teachers: 'clases-de-musica',
  rehearsal: 'locales-de-ensayo', events: 'conciertos', posts: 'busco-banda' };
const SCHEMA_FOR = { musicians: 'Person', bands: 'MusicGroup', venues: 'MusicVenue', teachers: 'Person', rehearsal: 'LocalBusiness' };

function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * The same facts the app shows, as plain HTML inside <app-root> for crawlers that do not
 * run JavaScript (AI assistants). Angular replaces it on boot, so people never see it.
 */
function botBody(type, row, m, url) {
  const city = row.city || '';
  const hub = HUB_FOR[type];
  const more = hub ? `<p><a href="/${hub}${city && city !== 'Otra' ? '/' + slugify(city) : ''}">Más en BandYou${city ? ' ' + escapeHtml(city) : ''}</a> · <a href="/">BandYou, la red musical de España</a></p>` : '';
  return `<main><p>${escapeHtml(m.kicker || '')}</p><h1>${escapeHtml(m.title)}</h1>`
    + (m.text ? `<p>${escapeHtml(clip(m.text, 1200))}</p>` : '')
    + `<p><a href="${escapeHtml(url)}">Ver en BandYou</a> (escribir mensaje, guardar, compartir).</p>${more}</main>`;
}

function botJsonLd(type, row, m, url) {
  let ld = null;
  if (type === 'events') {
    ld = { '@type': 'Event', name: row.title, startDate: row.date, eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: row.venue || row.city || 'España', address: { '@type': 'PostalAddress', addressLocality: row.city || '', addressCountry: 'ES' } } };
  } else if (SCHEMA_FOR[type]) {
    ld = { '@type': SCHEMA_FOR[type], name: m.title,
      ...(row.city ? { address: { '@type': 'PostalAddress', addressLocality: row.city, addressCountry: 'ES' } } : {}) };
  }
  if (!ld) return '';
  ld = { '@context': 'https://schema.org', ...ld, url, ...(m.text ? { description: clip(m.text, 300) } : {}) };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
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
  const page = setMeta(html, { title: `${clip(m.title, 70)} · BandYou`, description, url, image: safeImage(m.image), type: m.type })
    .replace('<app-root></app-root>', `<app-root>${botBody(type, row, m, url)}</app-root>`)
    .replace('</head>', `${botJsonLd(type, row, m, url)}</head>`);
  res.end(page);
};
