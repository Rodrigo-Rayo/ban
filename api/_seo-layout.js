// HTML shell for the server-rendered SEO pages: same "Cartel" look as the app
// (paper, ink, poster red/yellow; Anton + Instrument Sans + JetBrains Mono from the
// app's own stylesheet), no JavaScript, readable by every crawler and AI assistant.
const { SITE, escapeHtml } = require('./_seo-data');

const NAV = [
  ['/busco-banda', 'Busco banda'], ['/busco-musicos', 'Busco músicos'], ['/locales-de-ensayo', 'Locales'],
  ['/clases-de-musica', 'Clases'], ['/conciertos', 'Conciertos'], ['/guias', 'Guías'],
];
const FOOTER = [
  ['/musicos', 'Músicos'], ['/bandas', 'Bandas'], ['/busco-banda', 'Busco banda'], ['/busco-musicos', 'Busco músicos'],
  ['/locales-de-ensayo', 'Locales de ensayo'], ['/clases-de-musica', 'Clases de música'],
  ['/salas-de-conciertos', 'Salas de conciertos'], ['/conciertos', 'Conciertos'], ['/guias', 'Guías'],
  ['/quedada', 'La quedada'], ['/legal/aviso-legal', 'Aviso legal'], ['/legal/privacidad', 'Privacidad'],
];

const CSS = `
:root{--paper:#f2ebdd;--card:#faf6ee;--ink:#141210;--muted:#5c554b;--red:#c23a1f;--yellow:#e8b931;--line:rgba(20,18,16,.15)}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 'Instrument Sans',system-ui,-apple-system,sans-serif}
a{color:inherit}
.wrap{max-width:72rem;margin:0 auto;padding:0 16px}
header.top{border-bottom:3px solid var(--ink);background:var(--paper)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:4px 16px;min-height:64px;flex-wrap:wrap;padding-top:12px;padding-bottom:4px}
.logo{font:400 30px/1.15 'Anton',Impact,sans-serif;text-decoration:none;letter-spacing:.5px}
.logo span,.red{color:var(--red)}
nav.main{display:flex;flex-wrap:wrap;gap:4px 16px;font:700 12px/1 'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase}
nav.main a{text-decoration:none;padding:12px 0}
nav.main a:hover{color:var(--red)}
.crumbs{font:700 11px/1.4 'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;color:var(--muted);margin:24px 0 8px}
.crumbs a{text-decoration:none}
.kicker{font:700 12px/1.3 'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;color:var(--red);margin:0 0 6px}
h1,h2,h3{font-family:'Anton',Impact,'Arial Narrow',sans-serif;font-weight:400;text-transform:uppercase;line-height:1.08;margin:0}
h1{font-size:clamp(2.4rem,7vw,4.5rem);margin-bottom:16px}
h2{font-size:clamp(1.6rem,4vw,2.2rem);margin:40px 0 14px}
h3{font-size:1.35rem}
.lead{font-size:1.15rem;max-width:46rem;margin:0 0 20px}
.answer{background:var(--card);border:2px solid var(--ink);box-shadow:5px 5px 0 var(--ink);padding:16px 18px;max-width:46rem;font-size:1.1rem;margin:0 0 24px}
.btn{display:inline-flex;align-items:center;min-height:48px;padding:0 20px;background:var(--red);color:#fff;border:2px solid var(--ink);box-shadow:4px 4px 0 var(--ink);font:700 13px/1 'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;text-decoration:none}
.btn.alt{background:var(--card);color:var(--ink)}
.btns{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;list-style:none;padding:0;margin:0}
.card{display:flex;gap:12px;align-items:stretch;background:var(--card);border:2px solid var(--ink);text-decoration:none;min-height:88px}
.card:hover{box-shadow:4px 4px 0 var(--ink)}
.card .pic{width:84px;flex:none;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:center;font:400 40px/1 'Anton',Impact,sans-serif;overflow:hidden}
.card .pic img{width:100%;height:100%;object-fit:cover}
.card .body{padding:10px 12px 10px 0;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
.card h3{font-size:1.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card p{margin:0;font-size:.85rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card .txt{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.tag{font:700 11px/1 'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;border:1.5px solid var(--ink);padding:5px 7px;background:var(--card)}
.tag.y{background:var(--yellow)}
.empty{background:var(--card);border:2px dashed var(--ink);padding:20px;max-width:46rem}
.provinces{columns:2 160px;font-size:.92rem;padding:0;list-style:none;margin:0}
.provinces li{break-inside:avoid;padding:3px 0}
.provinces a{text-decoration:none}
.provinces a:hover{color:var(--red);text-decoration:underline}
.provinces .n{color:var(--muted);font-size:.8rem}
.provinces .has{font-weight:700}
details{border-top:1px solid var(--line);padding:12px 0;max-width:46rem}
summary{font-weight:700;cursor:pointer;min-height:28px}
details p{margin:8px 0 0}
article.guide{max-width:46rem}
article.guide p,article.guide li{font-size:1.05rem}
article.guide ol,article.guide ul{padding-left:1.3rem}
footer.bottom{border-top:3px solid var(--ink);margin-top:56px;padding:28px 0 40px}
footer.bottom nav{display:flex;flex-wrap:wrap;gap:6px 18px;font:700 12px/1.8 'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase}
footer.bottom nav a{text-decoration:none}
footer.bottom p{font-size:.85rem;color:var(--muted);max-width:46rem}
`;

let stylesheetHref = null;
/** The app's hashed stylesheet (fonts) — read once per instance from the built index.html. */
async function appStylesheet() {
  if (stylesheetHref !== null) return stylesheetHref;
  try {
    const html = await (await fetch(`${SITE}/index.html`)).text();
    const m = /href="(styles-[A-Za-z0-9]+\.css)"/.exec(html);
    stylesheetHref = m ? `/${m[1]}` : '';
  } catch {
    stylesheetHref = '';
  }
  return stylesheetHref;
}

/**
 * Full HTML document. `jsonLd` objects are serialised into one @graph; `<` is escaped
 * so user text can never close the script tag.
 */
async function page({ path, title, description, body, jsonLd = [], noindex = false }) {
  const url = SITE + path;
  const css = await appStylesheet();
  const ld = jsonLd.length
    ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonLd }).replace(/</g, '\\u003c')}</script>`
    : '';
  const t = escapeHtml(title), d = escapeHtml(description);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="BandYou"><meta property="og:locale" content="es_ES">
<meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${SITE}/og-default.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#f2ebdd">
${css ? `<link rel="stylesheet" href="${css}">` : ''}
<style>${CSS}</style>
${ld}
</head>
<body>
<header class="top"><div class="wrap">
<a class="logo" href="/" aria-label="BandYou, inicio">BAND<span>YOU</span></a>
<nav class="main" aria-label="Secciones">${NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="bottom"><div class="wrap">
<nav aria-label="Más secciones">${FOOTER.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</nav>
<p><strong>BandYou</strong> es la red social gratuita de la comunidad musical de España: músicos, bandas, salas de conciertos, profesores y locales de ensayo de las 50 provincias, con anuncios de «Se busca», agenda de conciertos y mensajes directos.</p>
</div></footer>
</body>
</html>`;
}

module.exports = { page };
