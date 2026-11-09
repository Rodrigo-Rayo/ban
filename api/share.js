// Vercel serverless function: link previews for shared pages.
// WhatsApp, Telegram, Facebook, X, LinkedIn… do not run JavaScript, so a shared
// /musicians/:id link would always show the generic card. vercel.json rewrites
// detail URLs here ONLY for crawler user agents; people still get the static SPA.
// It returns the built index.html with title, description, image and canonical
// filled in for that page (and a real 404 status for unknown ids).

const { PROVINCE_BY_SLUG, slugify } = require('./_seo-data');

const SITE = 'https://www.bandyou.es';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yxaurffzwtqsckfmnzdj.supabase.co';
// The anon key is public by design (it ships in the frontend bundle); env var overrides it.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXVyZmZ6d3Rxc2NrZm1uemRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTE2ODIsImV4cCI6MjA5MjI4NzY4Mn0.GUbfyBpaP8W_LFIT9IfMjuszgw-J87ANhOAJY8Tpj1E';
const DEFAULT_IMAGE = `${SITE}/og-default.jpg?v=2`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const POST_LABELS = {
  musician_seeking_band: 'Busca banda', band_seeking_musician: 'Busca músico', collab: 'Busca colaboración',
  looking_for_rehearsal: 'Busca local', session_offer: 'Ofrece sesiones', event_announcement: 'Concierto',
  gear_sale: 'Vende equipo', other: 'Anuncio',
};

/** Per route: table, columns, and how a row becomes a preview. */
const TYPES = {
  musicians: {
    table: 'musicians', cols: 'name,instrument,genre,city,description,avatar_url',
    meta: r => ({ title: r.name, seoTitle: `${r.name}, ${[firstOf(r.instrument), r.city].filter(Boolean).join(' en ') || 'músico'}`, kicker: [r.instrument, r.city].filter(Boolean).join(' · '), text: r.description, image: r.avatar_url }),
  },
  bands: {
    table: 'bands', cols: 'name,genre,city,description,avatar_url',
    meta: r => ({ title: r.name, seoTitle: `${r.name}, banda${r.genre ? ' de ' + firstOf(r.genre) : ''}${r.city ? ' en ' + r.city : ''}`, kicker: ['Banda', r.genre, r.city].filter(Boolean).join(' · '), text: r.description, image: r.avatar_url }),
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
    table: 'events', cols: 'title,venue,city,date,time,price,ticket_url,description,image_url',
    meta: r => ({ title: r.title, seoTitle: [r.title, [formatDate(r.date), r.city].filter(Boolean).join(', ')].filter(Boolean).join(': '), kicker: [formatDate(r.date), r.venue, r.city].filter(Boolean).join(' · '), text: r.description, image: r.image_url, type: 'article' }),
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

const firstOf = value => String(value || '').split(',')[0].trim();

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

// Province pages for the "more in <province>" links of each page type (api/hub.js pages).
const HUB_FOR = {
  musicians: () => [['musicos', 'Músicos'], ['busco-musicos', 'Busco músicos']],
  bands: () => [['bandas', 'Bandas'], ['busco-banda', 'Busco banda']],
  venues: () => [['salas-de-conciertos', 'Salas de conciertos']],
  teachers: () => [['clases-de-musica', 'Clases de música']],
  rehearsal: () => [['locales-de-ensayo', 'Locales de ensayo']],
  events: () => [['conciertos', 'Conciertos']],
  posts: row => (row.type === 'musician_seeking_band' || row.type === 'collab'
    ? [['busco-musicos', 'Busco músicos']]
    : row.type === 'looking_for_rehearsal' ? [['locales-de-ensayo', 'Locales de ensayo']] : [['busco-banda', 'Busco banda']]),
};
const SCHEMA_FOR = { musicians: 'Person', bands: 'MusicGroup', venues: 'MusicVenue', teachers: 'Person', rehearsal: 'LocalBusiness' };

/**
 * The same facts the app shows, as plain HTML inside <app-root> for crawlers that do not
 * run JavaScript (AI assistants). Angular replaces it on boot, so people never see it.
 */
function botBody(type, row, m, url) {
  const province = PROVINCE_BY_SLUG.get(slugify(row.city || '')) || '';
  const links = (HUB_FOR[type] ? HUB_FOR[type](row) : []).map(([hub, label]) =>
    `<a href="/${hub}${province ? '/' + slugify(province) : ''}">${escapeHtml(label)}${province ? ' en ' + escapeHtml(province) : ''}</a>`);
  const more = `<p>${[...links, '<a href="/feed">Se busca</a>', '<a href="/">BandYou, la red musical de España</a>'].join(' · ')}</p>`;
  return `<main><p>${escapeHtml(m.kicker || '')}</p><h1>${escapeHtml(m.title)}</h1>`
    + (m.text ? `<p>${escapeHtml(clip(m.text, 1200))}</p>` : '')
    + `<p><a href="${escapeHtml(url)}">Ver en BandYou</a> (escribir mensaje, guardar, compartir).</p>${more}</main>`;
}

/** Google needs a readable price on an offer; "10-15 € anticipada" gets no offer at all. */
function eventOffers(row, url) {
  const p = String(row.price ?? '').trim().toLowerCase();
  const free = /^(0+([.,]0+)?\s*€?|gratis|gratuito|gratuita|libre|entrada libre|free)$/.test(p);
  const amount = free ? '0' : (/^(\d+(?:[.,]\d{1,2})?)\s*€?$/.exec(p) || [])[1];
  if (amount === undefined) return {};
  return { offers: { '@type': 'Offer', url: /^https?:\/\//i.test(row.ticket_url || '') ? row.ticket_url : url, price: amount.replace(',', '.'), priceCurrency: 'EUR' } };
}

function botJsonLd(type, row, m, url) {
  const image = safeImage(m.image);
  const pic = image === DEFAULT_IMAGE ? {} : { image };
  let ld = null;
  if (type === 'events') {
    ld = { '@type': 'Event', name: row.title, startDate: row.time ? `${row.date}T${row.time}` : row.date, eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', ...pic, ...eventOffers(row, url),
      location: { '@type': 'Place', name: row.venue || row.city || 'España', address: { '@type': 'PostalAddress', addressLocality: row.city || '', addressCountry: 'ES' } } };
  } else if (SCHEMA_FOR[type]) {
    ld = { '@type': SCHEMA_FOR[type], name: m.title, ...pic,
      ...(type === 'bands' && row.genre ? { genre: row.genre } : {}),
      ...(row.city ? { address: { '@type': 'PostalAddress', addressLocality: row.city, addressCountry: 'ES' } } : {}) };
  }
  if (!ld) return '';
  ld = { '@context': 'https://schema.org', ...ld, url, ...(m.text ? { description: clip(m.text, 300) } : {}) };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

/** Results of the /test quiz (src/app/features/test/test-data.ts): id → name, for its link previews. */
const TEST_TYPES = {
  met: 'El metrónomo', chi: 'La chispa', lab: 'El laboratorio', age: 'La agenda',
  fab: 'La fábrica de temas', peg: 'El pegamento', com: 'El comodín', pue: 'Otra vez desde el puente',
};

/** App sections with no server page of their own: the same title and text the app sets. */
const PAGES = {
  feed: {
    path: '/feed', title: 'Se busca: busco banda o músicos · BandYou',
    description: 'Anuncios de bandas que buscan músico y de músicos que buscan banda o colaboración en toda España. Publica el tuyo gratis en BandYou.',
    async body() {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?select=id,type,title,text,city,author_name&user_id=not.is.null&created_at=gte.${new Date(Date.now() - 90 * 864e5).toISOString()}&order=created_at.desc&limit=30`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      });
      const rows = res.ok ? await res.json() : [];
      const items = rows.map(p => `<li><a href="/posts/${escapeHtml(p.id)}">${escapeHtml(clip(p.title || `${p.author_name}: ${(POST_LABELS[p.type] || 'Anuncio').toLowerCase()}`, 80))}</a>: ${escapeHtml([POST_LABELS[p.type], p.author_name, p.city].filter(Boolean).join(' · '))}</li>`);
      return `<main><h1>Se busca</h1><p>Anuncios de bandas que buscan músico y de músicos que buscan banda o colaboración en España, de los últimos tres meses.</p><ul>${items.join('')}</ul><p><a href="/busco-banda">Busco banda</a> · <a href="/busco-musicos">Busco músicos</a> · <a href="/">BandYou</a></p></main>`;
    },
  },
  quedada: {
    path: '/quedada', title: 'La quedada de BandYou',
    description: 'Ayudemos a las bandas a darse a conocer: cada mes sorteamos un bolo por provincia, lo promocionamos y quedamos para ir. Inscribe el tuyo gratis.',
    body: () => '<main><h1>La quedada de BandYou</h1><p>Ayudemos a las bandas a darse a conocer: cada mes sorteamos un bolo por provincia, lo promocionamos y quedamos para ir. Inscribe el tuyo gratis.</p><p><a href="/conciertos">Conciertos</a> · <a href="/guias/como-conseguir-bolos">Cómo conseguir bolos</a> · <a href="/">BandYou</a></p></main>',
  },
  colaboradores: {
    path: '/colaboradores', title: 'Colaboradores · BandYou',
    description: 'Salas, medios, promotoras y gente de la escena musical que colabora con BandYou.',
    body: () => '<main><h1>Colaboradores</h1><p>Gente de la escena que nos ha echado una mano: salas, medios, promotoras y gente de la escena musical que colabora con BandYou.</p><p><a href="/">BandYou</a></p></main>',
  },
  test: {
    path: '/test',
    title: q => TEST_TYPES[q.vs] ? `¿Encajas con «${TEST_TYPES[q.vs]}»? Test de banda · BandYou` : '¿Qué músico de banda eres? Test · BandYou',
    description: 'Un día de bolo en nueve decisiones, de la prueba de sonido al grupo de WhatsApp. Descubre qué músico eres en tu banda y con quién encajas. Gratis y sin cuenta.',
    image: q => `${SITE}/test/og${TEST_TYPES[q.vs] ? '-' + q.vs : ''}.png`,
    body: () => `<main><h1>¿Qué músico de banda eres?</h1><p>Un test de BandYou: un día de bolo en nueve decisiones. Al final sale qué músico eres en tu banda, con quién encajas y con quién chocas. Los resultados posibles son ${Object.values(TEST_TYPES).join(', ')}.</p><p><a href="/busco-banda">Busco banda</a> · <a href="/busco-musicos">Busco músicos</a> · <a href="/">BandYou</a></p></main>`,
  },
  'legal-privacidad': { path: '/legal/privacidad', title: 'Política de privacidad · BandYou', description: 'Política de privacidad de BandYou.', body: () => '' },
  'legal-terminos': { path: '/legal/terminos', title: 'Términos de uso · BandYou', description: 'Términos de uso de BandYou.', body: () => '' },
  'legal-cookies': { path: '/legal/cookies', title: 'Política de cookies · BandYou', description: 'Política de cookies de BandYou.', body: () => '' },
  'legal-aviso-legal': { path: '/legal/aviso-legal', title: 'Aviso legal · BandYou', description: 'Aviso legal de BandYou.', body: () => '' },
};

/** Replaces the content of an existing tag in index.html (or the whole tag), leaving everything else as built. */
function setMeta(html, { title, description, url, image, type, noindex }) {
  const t = escapeHtml(title), d = escapeHtml(description), u = escapeHtml(url), i = escapeHtml(image);
  // Replacer functions: a "$&" or "$'" in someone's title must stay literal text.
  const keepFirst = value => (_, first) => first + value;
  return html
    .replace(/<title>[^<]*<\/title>/, () => `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, keepFirst(d))
    .replace(/(<meta property="og:title" content=")[^"]*/, keepFirst(t))
    .replace(/(<meta property="og:description" content=")[^"]*/, keepFirst(d))
    .replace(/(<meta property="og:type" content=")[^"]*/, keepFirst(type || 'profile'))
    .replace(/(<meta property="og:url" content=")[^"]*/, keepFirst(u))
    .replace(/(<meta property="og:image" content=")[^"]*/, keepFirst(i))
    .replace(/\s*<meta property="og:image:(width|height)" content="\d+">/g, image === DEFAULT_IMAGE ? '$&' : '')
    .replace(/(<meta name="twitter:title" content=")[^"]*/, keepFirst(t))
    .replace(/(<meta name="twitter:description" content=")[^"]*/, keepFirst(d))
    .replace(/(<meta name="twitter:image" content=")[^"]*/, keepFirst(i))
    .replace(/(<link rel="canonical" href=")[^"]*/, keepFirst(u))
    .replace(/(<meta name="robots" content=")[^"]*/, keepFirst(noindex ? 'noindex' : 'index,follow,max-image-preview:large'));
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

  const pageKey = String(req.query.page || '');
  const section = Object.hasOwn(PAGES, pageKey) ? PAGES[pageKey] : null;
  if (section) {
    const pageUrl = SITE + section.path;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    let content = '';
    try { content = await section.body(); } catch (err) { console.error('[share] page', err?.message); }
    // A section's title or image can depend on the link (the /test challenge link carries ?vs=).
    const query = { vs: Object.hasOwn(TEST_TYPES, String(req.query.vs || '')) ? String(req.query.vs) : '' };
    const pick = v => (typeof v === 'function' ? v(query) : v);
    return res.end(setMeta(html, { title: pick(section.title), description: section.description, url: pageUrl, image: pick(section.image) || DEFAULT_IMAGE, type: 'website' })
      .replace('<app-root></app-root>', () => `<app-root>${content}</app-root>`));
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
  const page = setMeta(html, { title: `${clip(m.seoTitle || m.title, 70)} · BandYou`, description, url, image: safeImage(m.image), type: m.type })
    .replace('<app-root></app-root>', () => `<app-root>${botBody(type, row, m, url)}</app-root>`)
    .replace('</head>', () => `${botJsonLd(type, row, m, url)}</head>`);
  res.end(page);
};
