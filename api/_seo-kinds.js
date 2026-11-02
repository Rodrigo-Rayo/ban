// What each server-rendered SEO page shows: /<kind> (all of Spain) and /<kind>/<province>.
// Texts answer the search ("busco banda en Madrid") first; lists are real BandYou data.
const { list, rest, countByProvince, shortDate, today, daysAgo } = require('./_seo-data');

const SEEKS = {
  musician_seeking_band: 'Busca banda', band_seeking_musician: 'Busca músico', collab: 'Busca colaboración',
  looking_for_rehearsal: 'Busca local', session_offer: 'Ofrece sesiones', other: 'Anuncio',
};
const askLabel = p => (p.type === 'band_seeking_musician' && p.instrument ? `Busca ${String(p.instrument).toLowerCase()}` : SEEKS[p.type] || 'Anuncio');
const en = prov => (prov ? `en ${prov}` : 'en España');
const de = prov => (prov ? `de ${prov}` : 'de toda España');
const postTitle = p => p.title || `${p.author_name || 'Alguien'}: ${askLabel(p).toLowerCase()}`;

/** Se busca posts of some types (last 3 months). `title` exists since 2026_10_post_title.sql. */
function posts(city, types, limit = 20) {
  return list('posts', 'id,type,title,text,city,instrument,author_name,created_at', {
    city, limit, filter: `type=in.(${types.join(',')})&created_at=gte.${daysAgo(90)}&user_id=not.is.null`,
  }).then(rows => rows.map(p => ({
    href: `/posts/${p.id}`, title: postTitle(p), sub: [p.author_name, p.city].filter(Boolean).join(' · '),
    tags: [askLabel(p)], text: p.text, stamp: true,
  })));
}

const person = (route, sub) => r => ({ href: `/${route}/${r.id}`, title: r.name, sub: sub(r), image: r.avatar_url });
const REAL = 'user_id=not.is.null';

const KINDS = {
  'busco-banda': {
    label: 'Busco banda',
    h1: p => `Busco banda ${en(p)}`,
    title: p => `Busco banda ${en(p)}: grupos que buscan músicos`,
    description: p => `Bandas ${de(p)} que buscan guitarra, batería, bajo, voz o teclados. Mira los anuncios de «Se busca» y escribe gratis a la banda en BandYou.`,
    intro: p => `Si tocas y buscas grupo ${en(p)}, aquí tienes las bandas que han publicado que necesitan músico y las que ya están en BandYou. Escríbeles directamente, es gratis. Si no ves lo tuyo, publica tu propio anuncio «Busco banda» y crea tu perfil para que las bandas te encuentren.`,
    count: { table: 'bands', filter: REAL, postTypes: ['band_seeking_musician'] },
    noun: 'bandas y anuncios de bandas que buscan músico',
    async items(city) {
      const [ads, bands] = await Promise.all([
        posts(city, ['band_seeking_musician']),
        list('bands', 'id,name,city,genre,avatar_url', { city, filter: REAL }),
      ]);
      return [...ads, ...bands.map(person('bands', b => ['Banda', b.genre, b.city].filter(Boolean).join(' · ')))];
    },
    faq: p => [
      [`¿Cómo encuentro banda ${en(p)}?`, `Crea tu perfil gratis en BandYou con tu instrumento, estilos y provincia, revisa los anuncios de «Se busca» de bandas que necesitan músico y escríbeles por mensaje. También puedes publicar tu propio anuncio «Busco banda».`],
      ['¿Cuesta algo buscar banda en BandYou?', 'No. Crear el perfil, publicar anuncios y enviar mensajes es gratis.'],
      ['¿Qué pongo en mi anuncio de busco banda?', 'Tu instrumento, nivel, estilos, días que puedes ensayar, si tienes equipo propio y un enlace a algo grabado. Cuanto más concreto, más respuestas.'],
    ],
    cta: { href: '/feed?new=1', label: 'Publicar «Busco banda»' },
  },
  'busco-musicos': {
    label: 'Busco músicos',
    h1: p => `Busco músicos ${en(p)}`,
    title: p => `Busco músicos para mi banda ${en(p)}`,
    description: p => `Músicos ${de(p)} que buscan banda: baterías, bajistas, guitarristas, cantantes y teclistas. Encuentra a quien te falta y escríbele gratis en BandYou.`,
    intro: p => `¿A tu banda le falta batería, bajista o voz ${en(p)}? Aquí están los músicos que han publicado que buscan grupo y los perfiles de músicos de la zona, con su instrumento y estilos. Escríbeles directamente o publica un anuncio para que te escriban ellos.`,
    count: { table: 'musicians', filter: REAL, postTypes: ['musician_seeking_band', 'collab'] },
    noun: 'músicos y anuncios de músicos que buscan banda',
    async items(city) {
      const [ads, people] = await Promise.all([
        posts(city, ['musician_seeking_band', 'collab']),
        list('musicians', 'id,name,city,instrument,genre,avatar_url', { city, filter: REAL }),
      ]);
      return [...ads, ...people.map(person('musicians', m => [m.instrument, m.city].filter(Boolean).join(' · ')))];
    },
    faq: p => [
      [`¿Dónde encuentro músicos para mi banda ${en(p)}?`, `En BandYou puedes filtrar músicos por provincia e instrumento, ver sus estilos y disponibilidad y escribirles por mensaje. También puedes publicar un anuncio en «Se busca» diciendo qué instrumento os falta.`],
      ['¿Cómo busco un batería o un bajista?', 'Filtra por instrumento en el directorio de músicos y publica un anuncio con el estilo, los días de ensayo y si tenéis local. Son los perfiles más buscados, así que conviene ser concreto.'],
      ['¿Es gratis?', 'Sí, buscar músicos, publicar anuncios y escribir mensajes en BandYou es gratis.'],
    ],
    cta: { href: '/feed?new=1', label: 'Publicar «Busco músico»' },
  },
  musicos: {
    label: 'Músicos',
    h1: p => `Músicos ${en(p)}`,
    title: p => `Músicos ${en(p)}: guitarristas, baterías, bajistas y voces`,
    description: p => `Directorio de músicos ${de(p)} por instrumento y estilo. Mira sus perfiles, su disponibilidad y escríbeles gratis en BandYou.`,
    intro: p => `Músicos ${de(p)} con perfil en BandYou: instrumento, estilos, días disponibles y si dan clases. Escríbeles para formar banda, cubrir un bolo o grabar.`,
    count: { table: 'musicians', filter: REAL },
    noun: 'músicos',
    items: city => list('musicians', 'id,name,city,instrument,genre,avatar_url', { city, filter: REAL, limit: 40 })
      .then(rows => rows.map(person('musicians', m => [m.instrument, m.city].filter(Boolean).join(' · ')))),
    faq: p => [
      [`¿Cómo contacto con músicos ${en(p)}?`, 'Entra en su perfil y pulsa «Escribir mensaje». Necesitas una cuenta gratuita de BandYou.'],
      ['¿Puedo aparecer en este directorio?', 'Sí: crea tu perfil de músico gratis con tu instrumento, estilos y provincia.'],
    ],
    cta: { href: '/auth/register', label: 'Crear mi perfil de músico' },
  },
  bandas: {
    label: 'Bandas',
    h1: p => `Bandas y grupos de música ${en(p)}`,
    title: p => `Bandas y grupos de música ${en(p)}`,
    description: p => `Bandas y grupos musicales ${de(p)} en BandYou: estilos, formación y si buscan músico o bolos. Escríbeles gratis.`,
    intro: p => `Grupos musicales ${de(p)} con perfil en BandYou. Algunos buscan músico, otros están disponibles para bolos: entra en su perfil para ver qué necesitan y escribirles.`,
    count: { table: 'bands', filter: REAL },
    noun: 'bandas',
    items: city => list('bands', 'id,name,city,genre,avatar_url', { city, filter: REAL, limit: 40 })
      .then(rows => rows.map(person('bands', b => [b.genre, b.city].filter(Boolean).join(' · ')))),
    faq: p => [
      [`¿Cómo contrato a una banda ${en(p)}?`, 'Entra en el perfil de la banda y escríbeles por mensaje. Muchas marcan si están disponibles para bolos.'],
      ['¿Cómo registro mi banda?', 'Crea un perfil de banda gratis con vuestro estilo, provincia y formación.'],
    ],
    cta: { href: '/auth/register', label: 'Registrar mi banda' },
  },
  'locales-de-ensayo': {
    label: 'Locales de ensayo',
    h1: p => `Locales de ensayo ${en(p)}`,
    title: p => `Locales de ensayo ${en(p)} por horas: precios y contacto`,
    description: p => `Locales de ensayo por horas ${en(p)}: precio, capacidad y contacto directo. Encuentra sala para ensayar con tu banda en BandYou.`,
    intro: p => `Salas de ensayo ${de(p)} publicadas en BandYou, con precio por hora y capacidad. Escribe al local para reservar. Si alquilas un local, publícalo gratis.`,
    count: { table: 'rehearsal_spaces', filter: REAL },
    noun: 'locales de ensayo',
    items: city => list('rehearsal_spaces', 'id,name,city,hourly_rate,capacity,avatar_url', { city, filter: REAL, limit: 40 })
      .then(rows => rows.map(r => ({ href: `/rehearsal/${r.id}`, title: r.name, image: r.avatar_url,
        sub: [r.city, r.capacity ? `${r.capacity} personas` : ''].filter(Boolean).join(' · '),
        tags: r.hourly_rate ? [`${r.hourly_rate} €/h`] : [] }))),
    faq: p => [
      [`¿Cuánto cuesta un local de ensayo ${en(p)}?`, p === 'Madrid'
        ? 'En las salas que consultamos en noviembre de 2026, una banda paga unos 10 a 21 euros la hora según la sala y la franja. Cada local de BandYou indica su precio por hora en la ficha.'
        : 'Depende de la ciudad, el tamaño y si incluye backline. Cada local de BandYou indica su precio por hora en la ficha.'],
      ['¿Es mejor alquilar por horas o por meses?', 'Por horas compensa si ensayáis poco o de forma irregular. Si ensayáis varias veces por semana o queréis dejar el equipo montado, suele salir mejor un local mensual, fijo o compartido con otra banda.'],
      ['¿Cómo reservo?', 'Escribe al local desde su ficha en BandYou para ver disponibilidad.'],
    ],
    cta: { href: '/rehearsal/new', label: 'Publicar mi local' },
  },
  'clases-de-musica': {
    label: 'Clases de música',
    h1: p => `Clases de música ${en(p)}`,
    title: p => `Clases de música ${en(p)}: guitarra, batería, piano, canto`,
    description: p => `Profesores de música ${en(p)}: guitarra, batería, bajo, piano y canto, presenciales u online. Mira precios y escribe gratis en BandYou.`,
    intro: p => `Profesores ${de(p)} y músicos que también dan clases, con su instrumento, modalidad y precio por hora. Escríbeles para pedir una clase de prueba.`,
    count: { table: 'teachers', filter: REAL },
    noun: 'profesores',
    async items(city) {
      const [teachers, lessons] = await Promise.all([
        list('teachers', 'id,name,city,instrument,hourly_rate,modality,avatar_url', { city, filter: REAL, limit: 30 }),
        // gives_lessons only exists after supabase/2026_10_lessons_alerts.sql: [] until then.
        list('musicians', 'id,name,city,instrument,avatar_url', { city, filter: `${REAL}&gives_lessons=is.true`, limit: 20 }),
      ]);
      return [
        ...teachers.map(t => ({ href: `/teachers/${t.id}`, title: t.name, image: t.avatar_url,
          sub: [t.instrument, t.city].filter(Boolean).join(' · '),
          tags: [t.hourly_rate ? `${t.hourly_rate} €/h` : '', t.modality || ''].filter(Boolean) })),
        ...lessons.map(m => ({ href: `/musicians/${m.id}`, title: m.name, image: m.avatar_url,
          sub: [m.instrument, m.city].filter(Boolean).join(' · '), tags: ['Da clases'] })),
      ];
    },
    faq: p => [
      [`¿Dónde encuentro clases de guitarra o batería ${en(p)}?`, 'En BandYou puedes filtrar profesores por instrumento y provincia y escribirles directamente.'],
      ['¿Hay clases online?', 'Sí, cada profesor indica si da clases presenciales, online o ambas.'],
    ],
    cta: { href: '/teachers/new', label: 'Ofrecer clases' },
  },
  'salas-de-conciertos': {
    label: 'Salas de conciertos',
    h1: p => `Salas de conciertos ${en(p)}`,
    title: p => `Salas de conciertos ${en(p)}: dónde tocar`,
    description: p => `Salas y bares con música en directo ${en(p)}: aforo, estilos que programan y contacto para tocar. En BandYou.`,
    intro: p => `Salas ${de(p)} que programan música en directo, con su aforo y estilos. Si tienes banda, escríbeles para proponer un bolo.`,
    count: { table: 'venues', filter: REAL },
    noun: 'salas',
    items: city => list('venues', 'id,name,city,capacity,avatar_url', { city, filter: REAL, limit: 40 })
      .then(rows => rows.map(v => ({ href: `/venues/${v.id}`, title: v.name, image: v.avatar_url,
        sub: [v.city, v.capacity ? `${v.capacity} personas` : ''].filter(Boolean).join(' · ') }))),
    faq: p => [
      [`¿Cómo consigo tocar en una sala ${en(p)}?`, 'Prepara un enlace con tu música y fechas posibles, y escribe a la sala desde su perfil. Apúntate también a La quedada de BandYou: cada mes se sortea la promoción de un bolo por provincia.'],
    ],
    cta: { href: '/venues/new', label: 'Publicar mi sala' },
  },
  conciertos: {
    label: 'Conciertos',
    h1: p => `Conciertos ${en(p)}`,
    title: p => `Conciertos ${en(p)}: agenda de bolos y música en directo`,
    description: p => `Próximos conciertos ${en(p)} de bandas emergentes: fecha, sala y entradas. La agenda de BandYou.`,
    intro: p => `Próximos bolos ${de(p)} publicados por bandas y salas en BandYou. Apoya la escena: ve a ver a una banda que no conoces.`,
    count: { table: 'events', filter: `date=gte.${today()}` },
    noun: 'conciertos próximos',
    items: city => list('events', 'id,title,venue,city,date,time,genre', { city, filter: `date=gte.${today()}`, order: 'date.asc', limit: 40 })
      .then(rows => rows.map(e => ({ href: `/events/${e.id}`, title: e.title,
        sub: [e.venue, e.city].filter(Boolean).join(' · '), tags: [shortDate(e.date), e.genre].filter(Boolean), date: e.date }))),
    faq: p => [
      [`¿Qué conciertos hay ${en(p)}?`, 'Aquí tienes los próximos bolos publicados en BandYou, ordenados por fecha.'],
      ['¿Cómo publico mi concierto?', 'Crea una cuenta gratis y publica el evento con fecha, sala y cartel. Si es de tu banda, inscríbelo también en La quedada.'],
    ],
    cta: { href: '/events/create', label: 'Publicar un concierto' },
  },
};

/**
 * Counts change slowly and every page wants them: keep them for a while per instance.
 * A read that fails comes back empty (rest() never throws), so an empty result is not kept:
 * one Supabase hiccup must not blank the counts for ten minutes.
 */
const memo = new Map();
function cached(key, load, isEmpty, ms = 600000) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value;
  const value = load();
  memo.set(key, { at: Date.now(), value });
  value.then(v => { if (isEmpty(v)) memo.delete(key); }, () => memo.delete(key));
  return value;
}

const SEEKING_RECENT = types => `type=in.(${types.join(',')})&created_at=gte.${daysAgo(90)}&user_id=not.is.null`;

/** Province → how many results a kind's page lists: profiles plus, where they show, recent ads. */
function kindCounts(kind) {
  return cached(`kind:${kind}`, async () => {
    const { table, filter, postTypes } = KINDS[kind].count;
    const [base, ads] = await Promise.all([
      countByProvince(table, filter),
      postTypes ? countByProvince('posts', SEEKING_RECENT(postTypes)) : new Map(),
    ]);
    for (const [city, n] of ads) base.set(city, (base.get(city) || 0) + n);
    return base;
  }, counts => counts.size === 0);
}

/** "Busco batería en Madrid": who plays it, and the bands looking for it. */
const INSTRUMENTS = [
  ['guitarrista', 'Guitarra', 'guitarrista', 'guitarristas'], ['bajista', 'Bajo', 'bajista', 'bajistas'],
  ['bateria', 'Batería', 'batería', 'baterías'], ['cantante', 'Voz', 'cantante', 'cantantes'],
  ['teclista', 'Teclados', 'teclista', 'teclistas'], ['pianista', 'Piano', 'pianista', 'pianistas'],
  ['saxofonista', 'Saxofón', 'saxofonista', 'saxofonistas'], ['trompetista', 'Trompeta', 'trompetista', 'trompetistas'],
  ['violinista', 'Violín', 'violinista', 'violinistas'], ['flautista', 'Flauta', 'flautista', 'flautistas'],
  ['clarinetista', 'Clarinete', 'clarinetista', 'clarinetistas'], ['contrabajista', 'Contrabajo', 'contrabajista', 'contrabajistas'],
  ['arpista', 'Arpa', 'arpista', 'arpistas'], ['percusionista', 'Percusión', 'percusionista', 'percusionistas'],
].map(([slug, name, one, many]) => ({ slug, name, one, many }));
const INSTRUMENT_BY_SLUG = new Map(INSTRUMENTS.map(i => [i.slug, i]));

/** An instrument page below this many results is kept out of search engines (thin). */
const MIN_INSTRUMENT_RESULTS = 3;

/** Instrument columns hold comma lists ("Guitarra, Bajo"); "Bajo" must not match "Contrabajo". */
const plays = (value, name) => String(value || '').split(',').some(part => part.trim().toLowerCase() === name.toLowerCase());

/** One read of who plays what, shared by every instrument page and the sitemap. */
function instrumentRows() {
  return cached('instruments', async () => {
    const [musicians, ads] = await Promise.all([
      list('musicians', 'id,name,city,instrument,genre,avatar_url', { filter: REAL, limit: 2000 }),
      list('posts', 'id,type,title,text,city,instrument,author_name,created_at', {
        filter: `${SEEKING_RECENT(['musician_seeking_band', 'band_seeking_musician'])}&instrument=not.is.null`, limit: 1000,
      }),
    ]);
    return { musicians, ads };
  }, rows => rows.musicians.length === 0);
}

async function instrumentResults(instrument, province) {
  const { musicians, ads } = await instrumentRows();
  const here = r => !province || r.city === province;
  const ad = p => ({ href: `/posts/${p.id}`, title: postTitle(p), sub: [p.author_name, p.city].filter(Boolean).join(' · '), tags: [askLabel(p)], text: p.text, stamp: true });
  const matching = ads.filter(p => plays(p.instrument, instrument.name) && here(p));
  return {
    people: [
      ...matching.filter(p => p.type === 'musician_seeking_band').map(ad),
      ...musicians.filter(m => plays(m.instrument, instrument.name) && here(m))
        .map(person('musicians', m => [m.instrument, m.city].filter(Boolean).join(' · '))),
    ].slice(0, 40),
    bands: matching.filter(p => p.type === 'band_seeking_musician').map(ad),
  };
}

/** Instrument → province → results, for the links between pages and the sitemap. */
async function instrumentCounts() {
  const { musicians, ads } = await instrumentRows();
  const out = new Map(INSTRUMENTS.map(i => [i.slug, new Map()]));
  for (const row of [...musicians, ...ads]) {
    if (!row.city) continue;
    for (const i of INSTRUMENTS) {
      if (!plays(row.instrument, i.name)) continue;
      const counts = out.get(i.slug);
      counts.set(row.city, (counts.get(row.city) || 0) + 1);
    }
  }
  return out;
}

/** "Busco banda de rock en Madrid": musicians, bands and ads of a style. `names` are the app's genre values. */
const GENRES = [
  ['rock', 'rock', ['rock']], ['pop', 'pop', ['pop']], ['indie', 'indie', ['indie']], ['metal', 'metal', ['metal']],
  ['punk', 'punk', ['punk']], ['blues', 'blues', ['blues']], ['jazz', 'jazz', ['jazz']], ['funk-soul', 'funk y soul', ['funk', 'soul']],
  ['versiones', 'versiones', ['versiones']], ['electronica', 'música electrónica', ['electrónica']],
  ['hip-hop', 'hip-hop y rap', ['hip-hop', 'rap']], ['reggae', 'reggae', ['reggae']], ['latino', 'música latina', ['latino']],
  ['flamenco', 'flamenco', ['flamenco']], ['folk', 'folk', ['folk']], ['experimental', 'música experimental', ['experimental']],
].map(([slug, label, names]) => ({ slug, label, names }));
const GENRE_BY_SLUG = new Map(GENRES.map(g => [g.slug, g]));

/** Genre columns hold lists like "Rock, Funk / Soul". */
const hasGenre = (value, genre) => String(value || '').split(/[,/]/).some(part => genre.names.includes(part.trim().toLowerCase()));

/** One read of who plays which style, shared by every style page and the sitemap. */
function genreRows() {
  return cached('genres', async () => {
    const [{ musicians }, bands, ads] = await Promise.all([
      instrumentRows(),
      list('bands', 'id,name,city,genre,avatar_url', { filter: REAL, limit: 2000 }),
      list('posts', 'id,type,title,text,city,instrument,genre,author_name,created_at', {
        filter: `${SEEKING_RECENT(['musician_seeking_band', 'band_seeking_musician'])}&genre=not.is.null`, limit: 1000,
      }),
    ]);
    // The same ad reposted is one result: it must not lift a thin page over the threshold.
    const seen = new Set();
    const uniqueAds = ads.filter(p => {
      const key = `${postTitle(p)}|${p.text || ''}`.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { musicians, bands, ads: uniqueAds };
  }, rows => rows.musicians.length === 0 || rows.bands.length === 0);
}

async function genreResults(genre, province) {
  const { musicians, bands, ads } = await genreRows();
  const here = r => !province || r.city === province;
  const ad = p => ({ href: `/posts/${p.id}`, title: postTitle(p), sub: [p.author_name, p.city].filter(Boolean).join(' · '), tags: [askLabel(p)], text: p.text, stamp: true });
  const matching = ads.filter(p => hasGenre(p.genre, genre) && here(p));
  return {
    bands: [
      ...matching.filter(p => p.type === 'band_seeking_musician').map(ad),
      ...bands.filter(b => hasGenre(b.genre, genre) && here(b)).map(person('bands', b => ['Banda', b.genre, b.city].filter(Boolean).join(' · '))),
    ].slice(0, 40),
    people: [
      ...matching.filter(p => p.type === 'musician_seeking_band').map(ad),
      ...musicians.filter(m => hasGenre(m.genre, genre) && here(m)).map(person('musicians', m => [m.instrument, m.city].filter(Boolean).join(' · '))),
    ].slice(0, 40),
  };
}

/** Style → province → results, for the links between pages and the sitemap. */
async function genreCounts() {
  const { musicians, bands, ads } = await genreRows();
  const out = new Map(GENRES.map(g => [g.slug, new Map()]));
  for (const row of [...musicians, ...bands, ...ads]) {
    if (!row.city) continue;
    for (const g of GENRES) {
      if (!hasGenre(row.genre, g)) continue;
      const counts = out.get(g.slug);
      counts.set(row.city, (counts.get(row.city) || 0) + 1);
    }
  }
  return out;
}

module.exports = {
  KINDS, rest, kindCounts, INSTRUMENTS, INSTRUMENT_BY_SLUG, MIN_INSTRUMENT_RESULTS, instrumentResults, instrumentCounts,
  GENRES, GENRE_BY_SLUG, genreResults, genreCounts,
};
