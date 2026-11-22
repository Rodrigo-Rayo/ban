// Build step: static HTML for the tool pages (/afinador, /afinador/<instrumento>, /metronomo).
//
// The SPA's index.html carries the home <title>, description and canonical, so a crawler reading the
// raw HTML of /afinador saw a duplicate of the home page. This writes dist/.../<path>/index.html with
// the page's own head tags, JSON-LD and readable content in <noscript>, all taken from the same JSON
// files the Angular components render. Every visitor (bot or person) gets the same file; Angular
// then boots in <app-root> as usual. No user-agent switching.
//
// Fails with a non-zero exit if the index.html markers it relies on are missing, so a changed
// template can never deploy silently without these pages.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = path.join(ROOT, 'src/app/features/tools');
const DIST = path.join(ROOT, 'dist/bandyou/browser');

const readJson = file => JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, file), 'utf8'));

export function loadSeo() {
  return {
    shared: readJson('tools-seo.json'),
    tuner: readJson('tuner/tuner-seo.json'),
    metronome: readJson('metronome/metronome-seo.json'),
  };
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON for a <script> block: no "</script>" or "<!--" can break out of it. */
function scriptJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** Same shape as toolJsonLd() in src/app/features/tools/tools-seo.ts. */
export function jsonLd(shared, { appName, path: pagePath, description, faqs, crumbs }) {
  const url = `${shared.siteUrl}${pagePath}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: appName,
        url,
        description,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Cualquiera (navegador web)',
        browserRequirements: 'Requiere un navegador moderno',
        inLanguage: 'es-ES',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [{ name: shared.homeLabel, path: '/' }, ...crumbs].map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: `${shared.siteUrl}${c.path}`,
        })),
      },
    ],
  };
}

const list = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const link = (href, label) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
const faqHtml = (title, faqs) =>
  `<h2>${escapeHtml(title)}</h2>${faqs.map(f => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}`;

function footerLinks(shared, otherTools) {
  const more = shared.moreLinks.map(l => `${link(l.href, l.label)}: ${escapeHtml(l.text ?? '')}`);
  const tools = otherTools.map(t => link(t.href, t.label));
  return `<h2>${escapeHtml(shared.moreTitle)}</h2>${list([...more, ...tools])}`
    + `<p>${escapeHtml(shared.cta.title)} ${escapeHtml(shared.cta.text)}</p>`;
}

/** Mirrors tuningRowsFor() in tuner-content.ts: the page's instruments first. */
function tuningRows(tuner, page) {
  const first = page.tableOrder.map(id => tuner.tunings.find(t => t.id === id)).filter(Boolean);
  return [...first, ...tuner.tunings.filter(t => !page.tableOrder.includes(t.id))];
}

/** Everything needed to render one tool URL. */
export function buildPages(seo) {
  const { shared, tuner, metronome } = seo;
  const main = tuner.pages.find(p => p.slug === '');
  if (!main) throw new Error('tuner-seo.json: missing the main /afinador page (slug "")');

  const tunerPages = tuner.pages.map(page => {
    const crumbs = page.slug
      ? [{ name: main.breadcrumb, path: main.path }, { name: page.breadcrumb, path: page.path }]
      : [{ name: page.breadcrumb, path: page.path }];
    const rows = tuningRows(tuner, page)
      .map(r => `<tr><th scope="row">${escapeHtml(r.instrument)}</th><td>${escapeHtml(r.notesEs)} (${escapeHtml(r.notesEn)})</td></tr>`)
      .join('');
    const others = tuner.pages.filter(p => p.path !== page.path).map(p => link(p.path, p.linkLabel));
    const body = [
      `<h1>${escapeHtml(page.h1)}</h1>`,
      `<p>${escapeHtml(page.lead)}</p>`,
      page.intro ? `<p>${escapeHtml(page.intro)}</p>` : '',
      `<h2>${escapeHtml(page.howTo.title)}</h2><ol>${page.howTo.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`,
      `<h2>${escapeHtml(tuner.tuningsTitle)}</h2><p>${escapeHtml(tuner.tuningsNote)}</p>`,
      `<table><thead><tr><th scope="col">Instrumento</th><th scope="col">Notas</th></tr></thead><tbody>${rows}</tbody></table>`,
      faqHtml(tuner.faqTitle, page.faqs),
      `<h2>${escapeHtml(tuner.instrumentLinksTitle)}</h2>${list(others)}`,
      footerLinks(shared, shared.tools.filter(t => t.href !== main.path)),
    ].join('');
    return {
      path: page.path,
      title: page.title,
      description: page.description,
      ld: jsonLd(shared, { appName: tuner.appName, path: page.path, description: page.description, faqs: page.faqs, crumbs }),
      body,
    };
  });

  const tempoRows = metronome.tempoTable
    .map(r => `<tr><th scope="row">${escapeHtml(r.name)}</th><td>${escapeHtml(r.range)}</td><td>${escapeHtml(r.feel)}</td></tr>`)
    .join('');
  const metronomePage = {
    path: metronome.path,
    title: metronome.title,
    description: metronome.description,
    ld: jsonLd(shared, {
      appName: metronome.appName,
      path: metronome.path,
      description: metronome.appDescription,
      faqs: metronome.faqs,
      crumbs: [{ name: metronome.breadcrumb, path: metronome.path }],
    }),
    body: [
      `<h1>${escapeHtml(metronome.h1)}</h1>`,
      `<p>${escapeHtml(metronome.lead)}</p>`,
      `<h2>${escapeHtml(metronome.tipsTitle)}</h2><ol>${metronome.tips.map(t => `<li><strong>${escapeHtml(t.title)}.</strong> ${escapeHtml(t.text)}</li>`).join('')}</ol>`,
      `<h2>${escapeHtml(metronome.tempoTitle)}</h2><p>${escapeHtml(metronome.tempoNote)}</p>`,
      `<table><thead><tr><th scope="col">Indicación</th><th scope="col">BPM</th><th scope="col">Carácter</th></tr></thead><tbody>${tempoRows}</tbody></table>`,
      faqHtml(metronome.faqTitle, metronome.faqs),
      footerLinks(shared, [
        ...shared.tools.filter(t => t.href !== metronome.path),
        ...tuner.pages.filter(p => p.slug).map(p => ({ href: p.path, label: p.linkLabel })),
      ]),
    ].join(''),
  };

  return [...tunerPages, metronomePage].map(p => ({ ...p, fullTitle: `${p.title} · ${shared.siteName}`, url: `${shared.siteUrl}${p.path}` }));
}

/** Replaces exactly one match of `re` in `html`, or throws naming the missing marker. */
function replaceOnce(html, re, replacement, marker) {
  const matches = html.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
  if (!matches || matches.length !== 1) {
    throw new Error(`index.html: expected exactly one ${marker}, found ${matches ? matches.length : 0}`);
  }
  return html.replace(re, () => replacement);
}

const metaRe = (attr, key) => new RegExp(`<meta ${attr}="${key.replace(/[.:]/g, '\\$&')}" content="[^"]*">`);

/** Renders one page from the built index.html. Throws if a marker is missing. */
export function renderPage(template, page) {
  const t = escapeHtml(page.fullTitle);
  const d = escapeHtml(page.description);
  const u = escapeHtml(page.url);
  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${t}</title>`, '<title>');
  html = replaceOnce(html, metaRe('name', 'description'), `<meta name="description" content="${d}">`, 'meta description');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${u}">`, 'canonical link');
  html = replaceOnce(html, metaRe('property', 'og:title'), `<meta property="og:title" content="${t}">`, 'og:title');
  html = replaceOnce(html, metaRe('property', 'og:description'), `<meta property="og:description" content="${d}">`, 'og:description');
  html = replaceOnce(html, metaRe('property', 'og:url'), `<meta property="og:url" content="${u}">`, 'og:url');
  html = replaceOnce(html, metaRe('name', 'twitter:title'), `<meta name="twitter:title" content="${t}">`, 'twitter:title');
  html = replaceOnce(html, metaRe('name', 'twitter:description'), `<meta name="twitter:description" content="${d}">`, 'twitter:description');
  // id="ld-json": SeoService replaces/clears this block on client-side navigation.
  html = replaceOnce(html, /<\/head>/, `<script type="application/ld+json" id="ld-json">${scriptJson(page.ld)}</script>\n</head>`, '</head>');
  // The body <noscript> (the one with the h1), not Angular's stylesheet <noscript> in <head>.
  html = replaceOnce(html, /<noscript>\s*<h1>[\s\S]*?<\/noscript>/, `<noscript>${page.body}</noscript>`, 'body <noscript> with <h1>');
  if (!html.includes('<app-root></app-root>')) throw new Error('index.html: <app-root></app-root> not found');
  return html;
}

export function main() {
  const indexFile = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexFile)) throw new Error(`${indexFile} not found: run ng build first`);
  const template = fs.readFileSync(indexFile, 'utf8');
  const pages = buildPages(loadSeo());
  for (const page of pages) {
    const out = path.join(DIST, page.path.replace(/^\//, ''), 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, renderPage(template, page));
    console.log(`prerender-tools: ${page.path} -> ${path.relative(ROOT, out)} | ${page.fullTitle}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`prerender-tools: FAILED: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
