// node --test scripts/prerender-tools.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPages, escapeHtml, loadSeo, renderPage } from './prerender-tools.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_INDEX = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
// What ng build adds: the critical-CSS <noscript> stylesheet in <head>.
const BUILT_LIKE = SRC_INDEX.replace('</head>', '<noscript><link rel="stylesheet" href="styles-X.css"></noscript></head>');

const seo = loadSeo();
const pages = buildPages(seo);
const one = (html, re) => {
  const m = html.match(new RegExp(re.source, 'g')) ?? [];
  assert.equal(m.length, 1, `expected one ${re}, got ${m.length}`);
  return html.match(re);
};

test('covers every tool URL', () => {
  assert.deepEqual(pages.map(p => p.path), ['/afinador', '/afinador/guitarra', '/afinador/bajo', '/afinador/ukelele', '/metronomo']);
});

for (const page of pages) {
  test(`head tags and content for ${page.path}`, () => {
    const html = renderPage(BUILT_LIKE, page);
    const url = `https://www.bandyou.es${page.path}`;
    assert.equal(one(html, /<title>([^<]*)<\/title>/)[1], escapeHtml(`${page.title} · BandYou`));
    assert.equal(one(html, /<link rel="canonical" href="([^"]*)">/)[1], url);
    const desc = one(html, /<meta name="description" content="([^"]*)">/)[1];
    assert.equal(desc, escapeHtml(page.description));
    assert.ok(page.description.length <= 155, `description too long (${page.description.length})`);
    assert.equal(one(html, /<meta property="og:url" content="([^"]*)">/)[1], url);
    assert.equal(one(html, /<meta property="og:title" content="([^"]*)">/)[1], escapeHtml(page.fullTitle));
    assert.equal(one(html, /<meta property="og:description" content="([^"]*)">/)[1], desc);
    assert.equal(one(html, /<meta name="twitter:title" content="([^"]*)">/)[1], escapeHtml(page.fullTitle));
    assert.equal(one(html, /<meta name="twitter:description" content="([^"]*)">/)[1], desc);
    assert.ok(!html.includes('href="https://www.bandyou.es/">'), 'home canonical must be gone');

    const ld = JSON.parse(one(html, /<script type="application\/ld\+json" id="ld-json">([^<]*)<\/script>/)[1]);
    assert.deepEqual(ld['@graph'].map(n => n['@type']), ['WebApplication', 'FAQPage', 'BreadcrumbList']);
    assert.equal(ld['@graph'][0].url, url);
    const crumbs = ld['@graph'][2].itemListElement;
    assert.equal(crumbs[crumbs.length - 1].item, url);
    assert.equal(crumbs[0].item, 'https://www.bandyou.es/');
    // Site-wide Organization/WebSite blocks are kept.
    assert.ok(html.includes('"@type": "Organization"') && html.includes('"@type": "WebSite"'));

    const noscript = one(html, /<noscript><h1>([\s\S]*?)<\/noscript>/)[0];
    for (const href of ['/busco-banda', '/busco-musicos', '/feed']) assert.ok(noscript.includes(`href="${href}"`), href);
    assert.ok(noscript.includes(page.path.startsWith('/afinador') ? 'href="/metronomo"' : 'href="/afinador"'));
    assert.ok(html.includes('<noscript><link rel="stylesheet" href="styles-X.css"></noscript>'), 'head noscript kept');
    assert.ok(html.includes('<app-root></app-root>'));
    assert.ok(!noscript.includes('BandYou: encuentra banda y músicos en España'), 'home h1 replaced');
  });
}

test('page text and FAQs match the JSON the components render', () => {
  for (const p of seo.tuner.pages) {
    const html = renderPage(BUILT_LIKE, pages.find(x => x.path === p.path));
    assert.ok(html.includes(`<h1>${escapeHtml(p.h1)}</h1>`));
    for (const f of p.faqs) assert.ok(html.includes(escapeHtml(f.q)) && html.includes(escapeHtml(f.a)), f.q);
    for (const s of p.howTo.steps) assert.ok(html.includes(escapeHtml(s)));
    const ld = JSON.parse(html.match(/id="ld-json">([^<]*)</)[1]);
    assert.deepEqual(ld['@graph'][1].mainEntity.map(q => q.name), p.faqs.map(f => f.q));
  }
  const m = renderPage(BUILT_LIKE, pages.find(x => x.path === '/metronomo'));
  for (const f of seo.metronome.faqs) assert.ok(m.includes(escapeHtml(f.q)));
  for (const r of seo.metronome.tempoTable) assert.ok(m.includes(escapeHtml(r.name)));
});

test('escapes HTML and keeps JSON-LD from breaking out of <script>', () => {
  const evil = { ...pages[0], title: '<b>"x"</b> & \'y\'', fullTitle: '<b>"x"</b> & \'y\'', description: '</script><script>alert(1)</script>',
    ld: { a: '</script><!--' }, body: '<h1>x</h1>' };
  const html = renderPage(BUILT_LIKE, evil);
  assert.ok(html.includes('<title>&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;</title>'));
  assert.ok(!html.includes('</script><script>alert(1)'));
  assert.ok(html.includes('{"a":"\\u003c/script\\u003e\\u003c!--"}'));
});

test('fails loudly when a marker is missing', () => {
  assert.throws(() => renderPage(SRC_INDEX.replace(/<link rel="canonical"[^>]*>/, ''), pages[0]), /canonical/);
  assert.throws(() => renderPage(SRC_INDEX.replace(/<noscript>[\s\S]*<\/noscript>/, ''), pages[0]), /noscript/);
  assert.throws(() => renderPage(SRC_INDEX.replace('<app-root></app-root>', ''), pages[0]), /app-root/);
});
