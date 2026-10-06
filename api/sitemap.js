// Vercel serverless function: dynamic sitemap.xml (rewritten from /sitemap.xml in vercel.json).
// Reads public directory data with the public anon key — RLS already exposes these rows.

const SITE = 'https://www.bandyou.es';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yxaurffzwtqsckfmnzdj.supabase.co';
// The anon key is public by design (it ships in the frontend bundle); env var overrides it.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXVyZmZ6d3Rxc2NrZm1uemRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTE2ODIsImV4cCI6MjA5MjI4NzY4Mn0.GUbfyBpaP8W_LFIT9IfMjuszgw-J87ANhOAJY8Tpj1E';

const { KINDS } = require('./_seo-kinds');
const { PROVINCES, slugify, countByProvince } = require('./_seo-data');
let GUIDES = [];
try { ({ GUIDES } = require('./_guides')); } catch { /* guides are optional */ }

const STATIC_PATHS = ['/', '/feed', '/quedada', '/shop', '/legal/privacidad', '/legal/terminos', '/legal/cookies', '/legal/aviso-legal'];

/** Server-rendered SEO pages (api/hub.js): every /<kind>, /<kind>/<province> with content, and the guides. */
async function hubPaths() {
  const paths = ['/guias', ...GUIDES.map(g => `/guias/${g.slug}`)];
  const kinds = Object.entries(KINDS);
  const counts = await Promise.all(kinds.map(([, def]) => countByProvince(def.count.table, def.count.filter)));
  kinds.forEach(([kind], i) => {
    paths.push(`/${kind}`);
    for (const p of PROVINCES) if ((counts[i].get(p) || 0) > 0) paths.push(`/${kind}/${slugify(p)}`);
  });
  return paths;
}

// [table, route prefix, extra PostgREST filter]
// user_id=not.is.null skips seed/demo rows that no real account owns.
const SOURCES = [
  ['musicians', '/musicians', 'user_id=not.is.null'],
  ['bands', '/bands', 'user_id=not.is.null'],
  ['venues', '/venues', 'user_id=not.is.null'],
  ['teachers', '/teachers', 'user_id=not.is.null'],
  ['rehearsal_spaces', '/rehearsal', 'user_id=not.is.null'],
  ['events', '/events', () => `user_id=not.is.null&date=gte.${new Date().toISOString().slice(0, 10)}`],
  ['gear_listings', '/shop', 'status=eq.active'],
  ['posts', '/posts', 'user_id=not.is.null'],
];

const MAX_PER_SOURCE = 5000;

async function fetchRows(table, filter) {
  const f = typeof filter === 'function' ? filter() : filter;
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id,created_at&${f}&order=created_at.desc&limit=${MAX_PER_SOURCE}`;
  const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
  return res.json();
}

function urlEntry(loc, lastmod) {
  return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`;
}

module.exports = async function handler(req, res) {
  const entries = STATIC_PATHS.map(p => urlEntry(SITE + p));
  try {
    for (const p of await hubPaths()) entries.push(urlEntry(SITE + p));
  } catch (err) {
    console.error('[sitemap] hub', err && err.message);
  }
  const results = await Promise.allSettled(SOURCES.map(([table, , filter]) => fetchRows(table, filter)));
  results.forEach((result, i) => {
    const prefix = SOURCES[i][1];
    if (result.status === 'rejected') {
      console.error('[sitemap]', result.reason?.message);
      return;
    }
    for (const row of result.value) entries.push(urlEntry(`${SITE}${prefix}/${row.id}`, row.created_at));
  });

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`);
};
