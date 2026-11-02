// Vercel serverless function: server-rendered SEO pages (no JavaScript needed).
//   /<kind>             e.g. /busco-banda          → all of Spain + province index
//   /<kind>/<province>  e.g. /busco-banda/madrid   → that province
//   /busco/<instrumento>[/<province>]               → who plays it, e.g. /busco/bateria/madrid
//   /estilo/<estilo>[/<province>]                   → bands and musicians of a style, e.g. /estilo/rock/madrid
//   /guias, /guias/<slug>                           → guides (api/_guides.js)
// Search engines and AI assistants (GPTBot, ClaudeBot, PerplexityBot…) do not run the
// Angular app, so these pages carry real HTML: H1, answer-first text, real profiles and
// posts as links, FAQ and JSON-LD. vercel.json rewrites the paths here.
const { SITE, PROVINCES, PROVINCE_BY_SLUG, slugify, escapeHtml: h, clip, safeImage, shortDate, today } = require('./_seo-data');
const { KINDS, kindCounts, INSTRUMENTS, INSTRUMENT_BY_SLUG, MIN_INSTRUMENT_RESULTS, instrumentResults, instrumentCounts, GENRES, GENRE_BY_SLUG, genreResults, genreCounts } = require('./_seo-kinds');
const { page } = require('./_seo-layout');

let GUIDES = [];
try { ({ GUIDES } = require('./_guides')); } catch (err) { console.error('[hub] guides', err && err.message); }

const breadcrumb = items => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })),
});
const faqLd = faq => ({
  '@type': 'FAQPage',
  mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});
const crumbsHtml = items => `<nav class="crumbs" aria-label="Migas de pan">${items
  .map(([name, path], i) => (i < items.length - 1 ? `<a href="${path}">${h(name)}</a> / ` : `<span aria-current="page">${h(name)}</span>`))
  .join('')}</nav>`;
const faqHtml = faq => `<h2>Preguntas frecuentes</h2>${faq
  .map(([q, a]) => `<details open><summary>${h(q)}</summary><p>${h(a)}</p></details>`).join('')}`;

function card(it) {
  const img = safeImage(it.image);
  const pic = img ? `<img src="${h(img)}" alt="" loading="lazy" width="84" height="88">` : h((it.title || '?').trim().charAt(0).toUpperCase());
  const tags = (it.tags || []).filter(Boolean);
  return `<li><a class="card" href="${h(it.href)}"><span class="pic" aria-hidden="true">${pic}</span><span class="body">
<h3>${h(clip(it.title, 70))}</h3>${it.sub ? `<p>${h(it.sub)}</p>` : ''}${it.text ? `<p class="txt">${h(clip(it.text, 160))}</p>` : ''}
${tags.length ? `<span class="tags">${tags.map(t => `<span class="tag${it.stamp ? ' y' : ''}">${h(t)}</span>`).join('')}</span>` : ''}
</span></a></li>`;
}

/** Links to the other provinces; those with nothing yet stay reachable but pass no ranking signal. */
function provinceList(prefix, counts, current) {
  const items = PROVINCES.filter(p => p !== current).map(p => {
    const n = counts.get(p) || 0;
    return `<li><a href="${prefix}/${slugify(p)}"${n ? ' class="has"' : ' rel="nofollow"'}>${h(p)}</a>${n ? ` <span class="n">(${n})</span>` : ''}</li>`;
  });
  return `<ul class="provinces">${items.join('')}</ul>`;
}

const dated = () => `${shortDate(today())} ${today().slice(0, 4)}`;
const sum = counts => [...counts.values()].reduce((a, n) => a + n, 0);

/** The answer in numbers, dated: what a reader, or an AI assistant quoting the page, wants first. */
function factLine(noun, n, prov) {
  if (!n) return '';
  return `<p class="answer"><strong>${n === 1 ? 'Hay 1 resultado' : `Hay ${n} ${h(noun)}`} ${prov ? `en ${h(prov)}` : 'en toda España'}</strong> en BandYou, a fecha de ${dated()}. Puedes escribir a cada uno gratis desde su perfil.</p>`;
}

/** The same province in the other sections: this is what ties a province together. */
async function otherKinds(kind, prov) {
  const others = Object.keys(KINDS).filter(k => k !== kind);
  const counts = await Promise.all(others.map(kindCounts));
  const links = others.map((k, i) => ({ k, n: prov ? counts[i].get(prov) || 0 : sum(counts[i]) })).filter(x => x.n > 0)
    .map(({ k, n }) => `<li><a class="has" href="/${k}${prov ? '/' + slugify(prov) : ''}">${h(KINDS[k].label)}</a> <span class="n">(${n})</span></li>`);
  return links.length ? `<h2>${prov ? `También en ${h(prov)}` : 'Más en BandYou'}</h2><ul class="provinces">${links.join('')}</ul>` : '';
}

/** "Busco batería", "Busco bajista"…: only pages with enough to show. */
async function instrumentLinks(prov, currentSlug) {
  const counts = await instrumentCounts();
  const links = INSTRUMENTS.filter(i => i.slug !== currentSlug).map(i => {
    const byProv = counts.get(i.slug);
    return { i, n: prov ? byProv.get(prov) || 0 : sum(byProv) };
  }).filter(x => x.n >= MIN_INSTRUMENT_RESULTS)
    .map(({ i, n }) => `<li><a class="has" href="/busco/${i.slug}${prov ? '/' + slugify(prov) : ''}">Busco ${h(i.one)}</a> <span class="n">(${n})</span></li>`);
  return links.length ? `<h2>Por instrumento${prov ? ` en ${h(prov)}` : ''}</h2><ul class="provinces">${links.join('')}</ul>` : '';
}

/** "Rock", "Pop"…: only pages with enough to show. */
async function genreLinks(prov, currentSlug) {
  const counts = await genreCounts();
  const links = GENRES.filter(g => g.slug !== currentSlug).map(g => {
    const byProv = counts.get(g.slug);
    return { g, n: prov ? byProv.get(prov) || 0 : sum(byProv) };
  }).filter(x => x.n >= MIN_INSTRUMENT_RESULTS)
    .map(({ g, n }) => `<li><a class="has" href="/estilo/${g.slug}${prov ? '/' + slugify(prov) : ''}">${h(g.label.charAt(0).toUpperCase() + g.label.slice(1))}</a> <span class="n">(${n})</span></li>`);
  return links.length ? `<h2>Por estilo${prov ? ` en ${h(prov)}` : ''}</h2><ul class="provinces">${links.join('')}</ul>` : '';
}

async function kindPage(kind, provSlug) {
  const def = KINDS[kind];
  const prov = provSlug ? PROVINCE_BY_SLUG.get(provSlug) : null;
  if (provSlug && !prov) return null;
  const path = prov ? `/${kind}/${provSlug}` : `/${kind}`;
  const [found, counts, others, byInstrument, byGenre] = await Promise.all([
    def.items(prov), kindCounts(kind), otherKinds(kind, prov),
    kind === 'busco-musicos' || kind === 'musicos' ? instrumentLinks(prov) : '',
    ['busco-banda', 'busco-musicos', 'bandas', 'musicos'].includes(kind) ? genreLinks(prov) : '',
  ]);
  // The same ad posted twice is listed once; two people with the same name are not the same.
  const seen = new Set();
  const items = found.filter(it => {
    const key = it.stamp ? `${it.title}|${it.text}`.trim().toLowerCase() : it.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const faq = def.faq(prov);
  const crumbs = [['BandYou', '/'], [def.label, `/${kind}`], ...(prov ? [[prov, path]] : [])];

  const listHtml = items.length
    ? `<h2>Lo último ${prov ? `en ${h(prov)}` : 'en España'}</h2><ul class="grid">${items.map(card).join('')}</ul>`
    : `<div class="empty"><p><strong>Todavía no hay nada publicado ${prov ? `en ${h(prov)}` : ''}.</strong> BandYou acaba de empezar: sé de los primeros y te encontrarán quienes busquen en ${h(prov || 'tu provincia')}.</p></div>`;

  const body = `${crumbsHtml(crumbs)}
<p class="kicker">BandYou · ${prov ? h(prov) : 'Toda España'}</p>
<h1>${h(def.h1(prov))}</h1>
${factLine(def.noun, prov ? counts.get(prov) || 0 : sum(counts), prov)}
<p class="lead">${h(def.intro(prov))}</p>
${kind === 'locales-de-ensayo' && prov === 'Madrid' ? '<p><a href="/guias/locales-de-ensayo-madrid">Mira cuánto cuesta un local en Madrid, por horas y por meses</a></p>' : ''}
<div class="btns"><a class="btn" href="${def.cta.href}">${h(def.cta.label)}</a><a class="btn alt" href="/auth/register">Crear perfil gratis</a></div>
${listHtml}
${byInstrument}
${byGenre}
${faqHtml(faq)}
${others}
<h2>${prov ? `${h(def.label)} en otras provincias` : `${h(def.label)} por provincia`}</h2>
${provinceList(`/${kind}`, counts, prov)}
<h2>Guías</h2>
<ul class="provinces">${GUIDES.map(g => `<li><a href="/guias/${g.slug}">${h(g.h1)}</a></li>`).join('')}</ul>`;

  const jsonLd = [breadcrumb(crumbs), faqLd(faq)];
  if (items.length) {
    jsonLd.push({
      '@type': 'ItemList', name: def.h1(prov),
      itemListElement: items.slice(0, 30).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + it.href, name: clip(it.title, 70) })),
    });
  }
  return {
    path, body, jsonLd,
    title: `${def.title(prov)} | BandYou`,
    description: def.description(prov),
    // A province with nothing yet is useful to visitors but thin for search engines.
    noindex: !!prov && items.length === 0,
  };
}

async function instrumentPage(slug, provSlug) {
  const inst = INSTRUMENT_BY_SLUG.get(slug);
  const prov = provSlug ? PROVINCE_BY_SLUG.get(provSlug) : null;
  if (!inst || (provSlug && !prov)) return null;
  const path = `/busco/${slug}${prov ? `/${provSlug}` : ''}`;
  const where = prov ? `en ${prov}` : 'en España';
  const [{ people, bands }, counts, otherInstruments] = await Promise.all([instrumentResults(inst, prov), instrumentCounts(), instrumentLinks(prov, slug)]);
  const total = people.length + bands.length;
  const crumbs = [['BandYou', '/'], ['Busco músicos', '/busco-musicos'], [`Busco ${inst.one}`, `/busco/${slug}`], ...(prov ? [[prov, path]] : [])];
  const faq = [
    [`¿Dónde encuentro un ${inst.one} ${where}?`, `En BandYou puedes ver los ${inst.many} ${where} con perfil o anuncio, sus estilos y su provincia, y escribirles gratis por mensaje. Si no ves a quien buscas, publica un anuncio en «Se busca» con el estilo, los días de ensayo y si tenéis local.`],
    ['¿Cuesta algo?', 'No. Crear el perfil, publicar anuncios y enviar mensajes en BandYou es gratis.'],
  ];
  const provinces = [...counts.get(slug)].filter(([p, n]) => n >= MIN_INSTRUMENT_RESULTS && p !== prov && PROVINCE_BY_SLUG.has(slugify(p)));
  const body = `${crumbsHtml(crumbs)}
<p class="kicker">BandYou · ${prov ? h(prov) : 'Toda España'}</p>
<h1>Busco ${h(inst.one)} ${h(where)}</h1>
${factLine(inst.many, people.length, prov)}
<p class="lead">¿A tu banda le falta ${h(inst.one)} ${h(where)}? Estos son los ${h(inst.many)} de BandYou${bands.length ? ', y más abajo las bandas que buscan uno ahora mismo' : ''}. Escríbeles directamente o publica tu anuncio para que te escriban a ti.</p>
<div class="btns"><a class="btn" href="/feed?new=1">Publicar un anuncio</a><a class="btn alt" href="/auth/register">Crear perfil gratis</a></div>
${people.length ? `<h2>${h(inst.many.charAt(0).toUpperCase() + inst.many.slice(1))} ${h(where)}</h2><ul class="grid">${people.map(card).join('')}</ul>` : ''}
${bands.length ? `<h2>Bandas que buscan ${h(inst.one)}</h2><ul class="grid">${bands.map(card).join('')}</ul>` : ''}
${total ? '' : `<div class="empty"><p><strong>Todavía no hay ${h(inst.many)} ${h(where)}.</strong> Publica un anuncio y te encontrarán quienes busquen en tu zona.</p></div>`}
${faqHtml(faq)}
${otherInstruments}
${provinces.length ? `<h2>Busco ${h(inst.one)} en otras provincias</h2><ul class="provinces">${provinces.map(([p, n]) => `<li><a class="has" href="/busco/${slug}/${slugify(p)}">${h(p)}</a> <span class="n">(${n})</span></li>`).join('')}</ul>` : ''}
<h2>Sigue por aquí</h2>
<ul class="provinces"><li><a class="has" href="/busco-musicos${prov ? `/${provSlug}` : ''}">Busco músicos ${h(where)}</a></li><li><a class="has" href="/guias/como-encontrar-musicos-para-tu-banda">Guía para encontrar músicos</a></li></ul>`;
  return {
    path, body,
    title: `Busco ${inst.one} ${where}: ${inst.many} para tu banda | BandYou`,
    description: `${inst.many.charAt(0).toUpperCase()}${inst.many.slice(1)} ${where} en BandYou: mira sus perfiles y estilos y escríbeles gratis para formar banda o cubrir un bolo.`,
    jsonLd: [breadcrumb(crumbs), faqLd(faq), ...(total ? [{ '@type': 'ItemList', name: `Busco ${inst.one} ${where}`,
      itemListElement: [...people, ...bands].slice(0, 30).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + it.href, name: clip(it.title, 70) })) }] : [])],
    noindex: total < MIN_INSTRUMENT_RESULTS,
  };
}

async function genrePage(slug, provSlug) {
  const genre = GENRE_BY_SLUG.get(slug);
  const prov = provSlug ? PROVINCE_BY_SLUG.get(provSlug) : null;
  if (!genre || (provSlug && !prov)) return null;
  const path = `/estilo/${slug}${prov ? `/${provSlug}` : ''}`;
  const where = prov ? `en ${prov}` : 'en España';
  const { label } = genre;
  const [{ people, bands }, counts, otherGenres] = await Promise.all([genreResults(genre, prov), genreCounts(), genreLinks(prov, slug)]);
  const total = people.length + bands.length;
  const crumbs = [['BandYou', '/'], ['Busco banda', '/busco-banda'], [`De ${label}`, `/estilo/${slug}`], ...(prov ? [[prov, path]] : [])];
  const faq = [
    [`¿Cómo encuentro una banda de ${label} ${where}?`, `En BandYou puedes ver las bandas de ${label} ${where} con perfil o anuncio y escribirles gratis por mensaje. Si no ves lo que buscas, publica un anuncio en «Se busca» con tu instrumento, los estilos que tocas y los días que puedes ensayar.`],
    [`¿Cómo encuentro músicos de ${label} para mi banda?`, `Mira los perfiles de esta página, con su instrumento y provincia, y escríbeles directamente. También puedes publicar un anuncio diciendo qué instrumento os falta.`],
    ['¿Cuesta algo?', 'No. Crear el perfil, publicar anuncios y enviar mensajes en BandYou es gratis.'],
  ];
  const provinces = [...counts.get(slug)].filter(([p, n]) => n >= MIN_INSTRUMENT_RESULTS && p !== prov && PROVINCE_BY_SLUG.has(slugify(p)));
  const body = `${crumbsHtml(crumbs)}
<p class="kicker">BandYou · ${prov ? h(prov) : 'Toda España'}</p>
<h1>Bandas y músicos de ${h(label)} ${h(where)}</h1>
${factLine(`bandas y músicos de ${label}`, total, prov)}
<p class="lead">¿Buscas banda de ${h(label)} ${h(where)}, o músicos para la tuya? Estas son las bandas, los músicos y los anuncios de BandYou. Escríbeles directamente o publica tu anuncio para que te escriban a ti.</p>
<div class="btns"><a class="btn" href="/feed?new=1">Publicar un anuncio</a><a class="btn alt" href="/auth/register">Crear perfil gratis</a></div>
${bands.length ? `<h2>Bandas de ${h(label)} ${h(where)}</h2><ul class="grid">${bands.map(card).join('')}</ul>` : ''}
${people.length ? `<h2>Músicos de ${h(label)} ${h(where)}</h2><ul class="grid">${people.map(card).join('')}</ul>` : ''}
${total ? '' : `<div class="empty"><p><strong>Todavía no hay bandas ni músicos de ${h(label)} ${h(where)}.</strong> Publica un anuncio y te encontrarán quienes busquen en tu zona.</p></div>`}
${faqHtml(faq)}
${otherGenres}
${provinces.length ? `<h2>${h(label.charAt(0).toUpperCase() + label.slice(1))} en otras provincias</h2><ul class="provinces">${provinces.map(([p, n]) => `<li><a class="has" href="/estilo/${slug}/${slugify(p)}">${h(p)}</a> <span class="n">(${n})</span></li>`).join('')}</ul>` : ''}
<h2>Sigue por aquí</h2>
<ul class="provinces"><li><a class="has" href="/busco-banda${prov ? `/${provSlug}` : ''}">Busco banda ${h(where)}</a></li><li><a class="has" href="/busco-musicos${prov ? `/${provSlug}` : ''}">Busco músicos ${h(where)}</a></li><li><a class="has" href="/guias/como-encontrar-banda">Guía para encontrar banda</a></li></ul>`;
  return {
    path, body,
    title: `Busco banda de ${label} ${where}: grupos y músicos | BandYou`,
    description: `Bandas y músicos de ${label} ${where} en BandYou: mira sus perfiles y anuncios y escríbeles gratis para formar banda o completar la tuya.`,
    jsonLd: [breadcrumb(crumbs), faqLd(faq), ...(total ? [{ '@type': 'ItemList', name: `Bandas y músicos de ${label} ${where}`,
      itemListElement: [...bands, ...people].slice(0, 30).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + it.href, name: clip(it.title, 70) })) }] : [])],
    noindex: total < MIN_INSTRUMENT_RESULTS,
  };
}

function guideIndex() {
  const crumbs = [['BandYou', '/'], ['Guías', '/guias']];
  return {
    path: '/guias', title: 'Guías para músicos: banda, ensayo, bolos | BandYou',
    description: 'Guías prácticas para músicos en España: cómo encontrar banda, buscar músicos, alquilar local de ensayo, conseguir bolos y montar una banda.',
    jsonLd: [breadcrumb(crumbs)],
    body: `${crumbsHtml(crumbs)}<p class="kicker">Guías BandYou</p><h1>Guías para músicos</h1>
<p class="lead">Consejos prácticos para encontrar banda o músicos, ensayar y tocar en directo en España.</p>
<ul class="grid">${GUIDES.map(g => card({ href: `/guias/${g.slug}`, title: g.h1, text: g.answer })).join('')}</ul>`,
  };
}

const GUIDE_PUBLISHED = '2026-10-06';

function guidePage(slug) {
  const g = GUIDES.find(x => x.slug === slug);
  if (!g) return null;
  const path = `/guias/${g.slug}`;
  const crumbs = [['BandYou', '/'], ['Guías', '/guias'], [g.h1, path]];
  const faq = (g.faq || []).map(f => [f.q, f.a]);
  const sections = (g.sections || []).map(s => `<h2>${h(s.h2)}</h2>
${(s.paragraphs || []).map(p => `<p>${h(p)}</p>`).join('')}
${s.steps && s.steps.length ? `<ol>${s.steps.map(x => `<li>${h(x)}</li>`).join('')}</ol>` : ''}
${s.bullets && s.bullets.length ? `<ul>${s.bullets.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}`).join('');
  const links = (g.links || []).filter(l => /^\/[a-z0-9/?=&.-]*$/i.test(l.href));
  return {
    path, title: `${g.title} | BandYou`, description: g.description,
    jsonLd: [
      breadcrumb(crumbs),
      { '@type': 'Article', headline: g.h1, description: g.description, inLanguage: 'es-ES', mainEntityOfPage: SITE + path,
        datePublished: GUIDE_PUBLISHED, dateModified: g.updated || GUIDE_PUBLISHED,
        author: { '@type': 'Organization', name: 'BandYou', url: SITE }, publisher: { '@type': 'Organization', name: 'BandYou', logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` } } },
      ...(faq.length ? [faqLd(faq)] : []),
    ],
    body: `${crumbsHtml(crumbs)}<article class="guide"><p class="kicker">Guía</p><h1>${h(g.h1)}</h1>
<p class="meta">Por el equipo de BandYou · Actualizada el <time datetime="${g.updated || GUIDE_PUBLISHED}">${shortDate(g.updated || GUIDE_PUBLISHED)} ${(g.updated || GUIDE_PUBLISHED).slice(0, 4)}</time></p>
<p class="answer">${h(g.answer)}</p>
${sections}
${faq.length ? faqHtml(faq) : ''}
${g.sources ? `<h2>Fuentes</h2><ul>${g.sources.map(l => `<li><a rel="nofollow noopener" href="${h(l.href)}">${h(l.label)}</a></li>`).join('')}</ul>` : ''}
${links.length ? `<h2>Sigue aquí</h2><div class="btns">${links.map((l, i) => `<a class="btn${i ? ' alt' : ''}" href="${h(l.href)}">${h(l.label)}</a>`).join('')}</div>` : ''}
<h2>Otras guías</h2>
<ul class="provinces">${GUIDES.filter(x => x.slug !== g.slug).map(x => `<li><a class="has" href="/guias/${x.slug}">${h(x.h1)}</a></li>`).join('')}</ul>
</article>`,
  };
}

module.exports = async function handler(req, res) {
  const kind = String(req.query.kind || '');
  const sub = String(req.query.prov || req.query.slug || '').toLowerCase();
  let data = null;
  try {
    if (kind === 'guias') data = sub ? guidePage(sub) : guideIndex();
    else if (kind === 'busco') data = await instrumentPage(String(req.query.slug || '').toLowerCase(), sub === String(req.query.slug || '').toLowerCase() ? null : sub);
    else if (kind === 'estilo') data = await genrePage(String(req.query.slug || '').toLowerCase(), sub === String(req.query.slug || '').toLowerCase() ? null : sub);
    else if (KINDS[kind] && /^[a-z0-9-]{0,40}$/.test(sub)) data = await kindPage(kind, sub || null);
  } catch (err) {
    console.error('[hub]', err && err.message);
    res.statusCode = 500;
    res.setHeader('Cache-Control', 'no-store');
    return res.end('Error');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!data) {
    res.statusCode = 404;
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.end(await page({ path: '/404', title: 'Página no encontrada | BandYou', description: 'Esta página no existe.', noindex: true,
      body: `<h1 style="margin-top:32px">Página no encontrada</h1><p class="lead">Prueba con <a href="/busco-banda">Busco banda</a>, <a href="/busco-musicos">Busco músicos</a> o vuelve al <a href="/">inicio</a>.</p>` }));
  }
  res.statusCode = 200;
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
  res.end(await page(data));
};

// Exposed for api/sitemap.js and tests.
module.exports.KIND_PATHS = Object.keys(KINDS);
module.exports.guideSlugs = () => GUIDES.map(g => g.slug);
