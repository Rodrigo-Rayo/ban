// Vercel serverless function: server-rendered SEO pages (no JavaScript needed).
//   /<kind>             e.g. /busco-banda          → all of Spain + province index
//   /<kind>/<province>  e.g. /busco-banda/madrid   → that province
//   /guias, /guias/<slug>                           → guides (api/_guides.js)
// Search engines and AI assistants (GPTBot, ClaudeBot, PerplexityBot…) do not run the
// Angular app, so these pages carry real HTML: H1, answer-first text, real profiles and
// posts as links, FAQ and JSON-LD. vercel.json rewrites the paths here.
const { SITE, PROVINCES, PROVINCE_BY_SLUG, slugify, countByProvince, escapeHtml: h, clip, safeImage } = require('./_seo-data');
const { KINDS } = require('./_seo-kinds');
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

function provinceList(kind, counts, current) {
  const items = PROVINCES.filter(p => p !== current).map(p => {
    const n = counts.get(p) || 0;
    return `<li><a href="/${kind}/${slugify(p)}"${n ? ' class="has"' : ''}>${h(p)}</a>${n ? ` <span class="n">(${n})</span>` : ''}</li>`;
  });
  return `<ul class="provinces">${items.join('')}</ul>`;
}

async function kindPage(kind, provSlug) {
  const def = KINDS[kind];
  const prov = provSlug ? PROVINCE_BY_SLUG.get(provSlug) : null;
  if (provSlug && !prov) return null;
  const path = prov ? `/${kind}/${provSlug}` : `/${kind}`;
  const [items, counts] = await Promise.all([def.items(prov), countByProvince(def.count.table, def.count.filter)]);
  const faq = def.faq(prov);
  const crumbs = [['BandYou', '/'], [def.label, `/${kind}`], ...(prov ? [[prov, path]] : [])];

  const listHtml = items.length
    ? `<h2>${prov ? `${h(def.label)} en ${h(prov)}` : 'Lo más reciente'}</h2><ul class="grid">${items.map(card).join('')}</ul>`
    : `<div class="empty"><p><strong>Todavía no hay nada publicado ${prov ? `en ${h(prov)}` : ''}.</strong> BandYou acaba de empezar: sé de los primeros y te encontrarán quienes busquen en ${h(prov || 'tu provincia')}.</p></div>`;

  const body = `${crumbsHtml(crumbs)}
<p class="kicker">BandYou · ${prov ? h(prov) : 'Toda España'}</p>
<h1>${h(def.h1(prov))}</h1>
<p class="lead">${h(def.intro(prov))}</p>
<div class="btns"><a class="btn" href="${def.cta.href}">${h(def.cta.label)}</a><a class="btn alt" href="/auth/register">Crear perfil gratis</a></div>
${listHtml}
${faqHtml(faq)}
<h2>${prov ? `${h(def.label)} en otras provincias` : `${h(def.label)} por provincia`}</h2>
${provinceList(kind, counts, prov)}
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
        author: { '@type': 'Organization', name: 'BandYou', url: SITE }, publisher: { '@type': 'Organization', name: 'BandYou', logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` } } },
      ...(faq.length ? [faqLd(faq)] : []),
    ],
    body: `${crumbsHtml(crumbs)}<article class="guide"><p class="kicker">Guía</p><h1>${h(g.h1)}</h1>
<p class="answer">${h(g.answer)}</p>
${sections}
${faq.length ? faqHtml(faq) : ''}
${links.length ? `<h2>Sigue aquí</h2><div class="btns">${links.map((l, i) => `<a class="btn${i ? ' alt' : ''}" href="${h(l.href)}">${h(l.label)}</a>`).join('')}</div>` : ''}
</article>`,
  };
}

module.exports = async function handler(req, res) {
  const kind = String(req.query.kind || '');
  const sub = String(req.query.prov || req.query.slug || '').toLowerCase();
  let data = null;
  try {
    if (kind === 'guias') data = sub ? guidePage(sub) : guideIndex();
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
