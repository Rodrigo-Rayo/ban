// Vercel serverless function: /api/counts → how many musicians, bands and live "Se busca" posts
// each place has, for the scene map (<app-scene-map>). Counts raw `city` values (Spanish provinces
// and "Región, País"); "Otra" and empty are skipped. Only the city column is ever selected.
const { SUPABASE_URL, ANON_KEY, daysAgo } = require('./_seo-data');

const PAGE = 1000;      // PostgREST max rows per request on Supabase
const MAX_PAGES = 20;
/** Same window Se busca opens on (SE_BUSCA_MAX_DAYS in src/app/core/utils/se-busca.ts). */
const POST_DAYS = 90;
const TIMEOUT_MS = 8000;

async function cities(table, filter = '') {
  const counts = {};
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=city${filter ? '&' + filter : ''}&order=id&limit=${PAGE}&offset=${page * PAGE}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${table} ${res.status}`);
    const rows = await res.json();
    for (const { city } of rows) {
      const c = typeof city === 'string' ? city.trim() : '';
      if (c && c !== 'Otra') counts[c] = (counts[c] || 0) + 1;
    }
    if (rows.length < PAGE) break;
  }
  return counts;
}

module.exports = async function handler(req, res) {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }
  try {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const postFilter = `created_at=gte.${encodeURIComponent(daysAgo(POST_DAYS))}&or=(gig_date.is.null,gig_date.gte.${today})`;
    const [musicians, bands, posts] = await Promise.all([cities('musicians'), cities('bands'), cities('posts', postFilter)]);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.end(JSON.stringify({ musicians, bands, posts }));
  } catch (err) {
    console.error('[counts]', err && err.message);
    res.statusCode = 500;
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: 'counts' }));
  }
};
