// Shared data helpers for the server-rendered SEO pages (api/hub.js).
// Only public columns are ever named: contact_email / phone are signed-in only
// (supabase/2026_10_private_contact.sql) and must never appear here.

const SITE = 'https://www.bandyou.es';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yxaurffzwtqsckfmnzdj.supabase.co';
// The anon key is public by design (it ships in the frontend bundle); env var overrides it.
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4YXVyZmZ6d3Rxc2NrZm1uemRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTE2ODIsImV4cCI6MjA5MjI4NzY4Mn0.GUbfyBpaP8W_LFIT9IfMjuszgw-J87ANhOAJY8Tpj1E';

/** Same list as src/app/core/constants/cities.ts (without "Otra"). */
const PROVINCES = [
  'A Coruña', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila',
  'Badajoz', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón',
  'Ceuta', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada', 'Guadalajara',
  'Guipúzcoa', 'Huelva', 'Huesca', 'Islas Baleares', 'Jaén', 'La Rioja', 'Las Palmas',
  'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra',
  'Ourense', 'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia',
  'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid',
  'Vizcaya', 'Zamora', 'Zaragoza',
];

function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const PROVINCE_BY_SLUG = new Map(PROVINCES.map(p => [slugify(p), p]));

/** GET a PostgREST query; [] on any error (a broken list must not break the page). */
async function rest(path) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) { console.error('[seo]', path.split('?')[0], res.status); return []; }
    return await res.json();
  } catch (err) {
    console.error('[seo]', path.split('?')[0], err && err.message);
    return [];
  }
}

const enc = encodeURIComponent;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString();

/** Rows of one directory table, optionally for one province. */
function list(table, cols, { city, filter = '', order = 'created_at.desc', limit = 30 } = {}) {
  const where = [city ? `city=eq.${enc(city)}` : '', filter].filter(Boolean).join('&');
  return rest(`${table}?select=${cols}${where ? '&' + where : ''}&order=${order}&limit=${limit}`);
}

/** How many rows each province has (for the province index and cross-links). */
async function countByProvince(table, filter = '') {
  const rows = await rest(`${table}?select=city${filter ? '&' + filter : ''}&limit=5000`);
  const counts = new Map();
  for (const r of rows) if (r.city) counts.set(r.city, (counts.get(r.city) || 0) + 1);
  return counts;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

/** Only images we host (Supabase storage). */
function safeImage(url) {
  return typeof url === 'string' && url.startsWith(`${SUPABASE_URL}/storage/`) ? url : null;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}` : '';
}

module.exports = {
  SITE, PROVINCES, PROVINCE_BY_SLUG, slugify, rest, list, countByProvince,
  escapeHtml, clip, safeImage, shortDate, today, daysAgo,
};
