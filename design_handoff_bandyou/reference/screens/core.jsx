// Search with filters, Musician profile, Chat, Map, Events, Rehearsal space
const T = window.BY_TOKENS;

// ─── SEARCH ──────────────────────────────────────────
function Search() {
  const [instrument, setInstrument] = React.useState('Bajo');
  const [distance, setDistance] = React.useState(5);
  const [level, setLevel] = React.useState([3, 4]);
  const [styles, setStyles] = React.useState(['Post-punk', 'Indie']);

  const results = [
    { name: 'Marta Vilches', role: 'Bajo', zone: 'Lavapiés', dist: '1.2 km', tone: 'plum', tags: ['POST-PUNK', 'SHOEGAZE'] },
    { name: 'Sergio Peña', role: 'Bajo · Contrabajo', zone: 'Embajadores', dist: '0.8 km', tone: 'amber', tags: ['JAZZ', 'FUNK'] },
    { name: 'Noa B.', role: 'Bajo', zone: 'Malasaña', dist: '2.1 km', tone: 'green', tags: ['INDIE', 'POP'] },
    { name: 'Kike Román', role: 'Bajo', zone: 'La Latina', dist: '1.9 km', tone: 'ink', tags: ['HARDCORE', 'PUNK'] },
    { name: 'Alba Serrano', role: 'Bajo · Voz', zone: 'Chueca', dist: '2.4 km', tone: 'plum', tags: ['SYNTH-POP'] },
    { name: 'Tomás Varela', role: 'Bajo', zone: 'Tetuán', dist: '4.3 km', tone: 'blue', tags: ['ROCK', 'BLUES'] },
  ];

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink, display: 'flex' }}>
      <div style={{ width: 260, background: T.white, borderRight: `1px solid ${T.line}`, padding: '20px 20px', overflow: 'auto' }}>
        <Wordmark size={18} />
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.line}` }}>
          <Meta items={['FILTROS']} style={{ marginBottom: 14 }} />

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Busco</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['Músico', 'Banda', 'Local', 'Profe'].map(x => (
                <Tag key={x} active={x === 'Músico'}>{x}</Tag>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Instrumento</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['Bajo', 'Batería', 'Guitarra', 'Voz', 'Teclados', 'Otro'].map(x => (
                <button key={x} onClick={() => setInstrument(x)} style={{
                  fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8,
                  padding: '4px 8px', border: `1px solid ${instrument === x ? T.ink : T.line2}`,
                  background: instrument === x ? T.ink : 'transparent', color: instrument === x ? T.paper : T.ink2,
                  borderRadius: 2, cursor: 'pointer',
                }}>{x}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>Distancia</span>
              <span style={{ fontFamily: T.mono, color: T.accent }}>{distance} km</span>
            </div>
            <input type="range" min="1" max="50" value={distance} onChange={e => setDistance(+e.target.value)}
                   style={{ width: '100%', accentColor: T.accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 9, color: T.muted, marginTop: 2 }}>
              <span>1</span><span>Madrid</span><span>50 km</span>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Nivel</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setLevel(level.includes(n) ? level.filter(l => l !== n) : [...level, n])} style={{
                  flex: 1, padding: '8px 0', fontFamily: T.mono, fontSize: 11, cursor: 'pointer',
                  background: level.includes(n) ? T.ink : 'transparent',
                  color: level.includes(n) ? T.paper : T.ink2,
                  border: `1px solid ${level.includes(n) ? T.ink : T.line2}`, borderRadius: 2,
                }}>L{n}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Estilos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['Rock', 'Indie', 'Post-punk', 'Jazz', 'Metal', 'Folk', 'Electrónica', 'Hip-hop', 'Flamenco'].map(x => (
                <button key={x} onClick={() => setStyles(styles.includes(x) ? styles.filter(s => s !== x) : [...styles, x])} style={{
                  fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8,
                  padding: '4px 8px', border: `1px solid ${styles.includes(x) ? T.accent : T.line2}`,
                  background: styles.includes(x) ? T.accent : 'transparent', color: styles.includes(x) ? T.paper : T.ink2,
                  borderRadius: 2, cursor: 'pointer',
                }}>{x}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Disponibilidad</div>
            {['Entre semana por la tarde', 'Fines de semana', 'Flexible', 'Solo online al principio'].map(x => (
              <label key={x} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: 12, color: T.ink2 }}>
                <input type="checkbox" style={{ accentColor: T.accent }} defaultChecked={x === 'Fines de semana'} />{x}
              </label>
            ))}
          </div>

          <Btn variant="primary" size="md" style={{ width: '100%' }}>Aplicar filtros</Btn>
          <button style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', fontSize: 12, color: T.muted, cursor: 'pointer', padding: 8 }}>Limpiar todo</button>
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 32px', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 36, letterSpacing: -0.5 }}>
              <span style={{ fontStyle: 'italic' }}>Bajistas</span> cerca de ti
            </div>
            <Meta items={['247 RESULTADOS', 'ORDENAR POR: CERCANÍA', 'LAVAPIÉS · 5 KM']} style={{ marginTop: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ padding: '8px 12px', background: T.ink, color: T.paper, border: 'none', fontSize: 11, fontFamily: T.mono, letterSpacing: 1, cursor: 'pointer' }}>LISTA</button>
            <button style={{ padding: '8px 12px', background: 'transparent', color: T.ink, border: `1px solid ${T.line2}`, fontSize: 11, fontFamily: T.mono, letterSpacing: 1, cursor: 'pointer' }}>MAPA</button>
            <button style={{ padding: '8px 12px', background: 'transparent', color: T.ink, border: `1px solid ${T.line2}`, fontSize: 11, fontFamily: T.mono, letterSpacing: 1, cursor: 'pointer' }}>CARDS</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {results.map((r, i) => (
            <div key={i} style={{ background: T.white, border: `1px solid ${T.line}`, padding: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <PhotoPlaceholder tone={r.tone} style={{ width: 60, height: 60 }} label={r.name.split(' ')[0].toLowerCase()} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 18, letterSpacing: -0.3 }}>{r.name}</div>
                  <Meta items={[r.role.toUpperCase(), r.zone.toUpperCase()]} style={{ marginTop: 2 }} />
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: 1 }}>{r.dist}</div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {r.tags.map(t => <Tag key={t}>{t}</Tag>)}
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Meta items={[`↗ ${r.dist}`]} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ padding: 6, border: `1px solid ${T.line2}`, background: 'transparent', cursor: 'pointer', display: 'flex' }}>{Icons.play(12)}</button>
                  <button style={{ padding: 6, border: `1px solid ${T.line2}`, background: 'transparent', cursor: 'pointer', display: 'flex' }}>{Icons.heart(12)}</button>
                  <button style={{ padding: 6, background: T.ink, color: T.paper, border: 'none', cursor: 'pointer', display: 'flex' }}>{Icons.chat(12)}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MUSICIAN PROFILE ────────────────────────────────
function MusicianProfile() {
  const [playing, setPlaying] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress(p => (p >= 1 ? 0 : p + 0.008)), 100);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink, overflow: 'auto' }}>
      <div style={{ padding: '16px 40px', borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink, display: 'flex' }}>{Icons.back(16)}</button>
          <Wordmark size={18} />
        </div>
        <Meta items={['PERFIL PÚBLICO', 'EDITADO HACE 3 DÍAS']} />
      </div>

      {/* HERO */}
      <div style={{ padding: '40px 40px 0', display: 'grid', gridTemplateColumns: '240px 1fr 180px', gap: 32 }}>
        <PhotoPlaceholder tone="plum" style={{ height: 240 }} label="marta vilches" />
        <div>
          <Meta items={['MÚSICA · LAVAPIÉS', 'EN LÍNEA HACE 2H']} style={{ marginBottom: 10 }} />
          <h1 style={{ fontFamily: T.serif, fontSize: 72, letterSpacing: -1.5, lineHeight: 0.95, margin: 0, fontWeight: 400 }}>
            Marta<br/><span style={{ fontStyle: 'italic' }}>Vilches.</span>
          </h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
            <Tag active>BAJO</Tag>
            <Tag>VOZ SECUNDARIA</Tag>
            <Tag>LV.4 AVANZADO</Tag>
            <Tag>3 AÑOS</Tag>
            <Tag>FINDES + MIÉRCOLES</Tag>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: T.ink2, marginTop: 20, maxWidth: 560 }}>
            Ex-bajista de Los Santos Vagos. Me formé en la EMS y llevo cuatro años tocando en Madrid.
            Busco proyecto con material propio, preferiblemente post-punk o shoegaze. Tengo local en Legazpi.
          </p>
        </div>
        <div>
          <div style={{ background: T.ink, color: T.paper, padding: 20, textAlign: 'center' }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, color: T.accentSoft }}>COMPARTÍS</div>
            <div style={{ fontFamily: T.display, fontSize: 28, fontWeight: 600, marginTop: 8, lineHeight: 1.1 }}>4 influencias<br/>y barrio</div>
            <div style={{ fontSize: 12, color: '#c9c1b4', marginTop: 10, lineHeight: 1.4 }}>Slowdive, IDLES, Viva Belgrado y 1 más. Ambos en Lavapiés.</div>
          </div>
          <Btn variant="accent" size="lg" style={{ width: '100%', marginTop: 10 }} icon={Icons.chat(14)}>Enviar mensaje</Btn>
          <Btn variant="ghost" size="md" style={{ width: '100%', marginTop: 6 }} icon={Icons.heart(13)}>Guardar</Btn>
        </div>
      </div>

      {/* SAMPLES */}
      <div style={{ padding: '40px', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, borderBottom: `1px solid ${T.ink}`, paddingBottom: 10 }}>
          <div style={{ fontFamily: T.serif, fontSize: 30, letterSpacing: -0.4 }}>Samples</div>
          <Meta items={['5 PISTAS', 'ACTUALIZADO HACE 1 SEMANA']} />
        </div>
        {[
          { t: 'Humedad — bajo line (demo)', d: '2:43', s: 'Post-punk · Original' },
          { t: 'Cover — This Charming Man', d: '3:02', s: 'Indie · The Smiths' },
          { t: 'Jam session Wurlitzer', d: '4:18', s: 'Improvisación · 2025' },
          { t: 'Slap study #3', d: '1:12', s: 'Funk · Ejercicio' },
        ].map((s, i) => {
          const active = playing === i;
          return (
            <div key={i} style={{
              padding: '14px 0', borderBottom: `1px solid ${T.line}`,
              display: 'grid', gridTemplateColumns: '40px 1.5fr 2fr auto', gap: 16, alignItems: 'center',
            }}>
              <button onClick={() => { setPlaying(active ? null : i); setProgress(0); }} style={{
                width: 32, height: 32, border: `1px solid ${T.ink}`, background: active ? T.ink : 'transparent',
                color: active ? T.paper : T.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16,
              }}>{active ? Icons.pause(11) : Icons.play(11)}</button>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.t}</div>
                <Meta items={[s.s]} style={{ marginTop: 2 }} />
              </div>
              <Waveform progress={active ? progress : 0} bars={60} height={24} />
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, letterSpacing: 0.5 }}>{s.d}</div>
            </div>
          );
        })}
      </div>

      {/* GRID */}
      <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div>
          <Meta items={['INFLUENCIAS']} style={{ marginBottom: 14 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {['Slowdive', 'IDLES', 'Viva Belgrado', 'La Habitación Roja', 'Fontaines D.C.', 'Triángulo de Amor Bizarro', 'La Plata', 'Carolina Durante'].map((x, i) => (
              <div key={x} style={{ background: T.white, border: `1px solid ${T.line}`, padding: 10, fontSize: 11, textAlign: 'center', color: T.ink2 }}>{x}</div>
            ))}
          </div>

          <Meta items={['LOCAL DE ENSAYO']} style={{ marginBottom: 14, marginTop: 28 }} />
          <div style={{ background: T.white, border: `1px solid ${T.line}`, padding: 14, display: 'flex', gap: 12 }}>
            <PhotoPlaceholder tone="ink" style={{ width: 60, height: 60 }} label="sala" />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.serif, fontSize: 18 }}>Estudios Bemol</div>
              <Meta items={['LEGAZPI', 'SALA 3', '15€/H']} style={{ marginTop: 2 }} />
            </div>
          </div>
        </div>
        <div>
          <Meta items={['EXPERIENCIA']} style={{ marginBottom: 14 }} />
          {[
            { yrs: '2023–24', t: 'Los Santos Vagos', d: 'Bajo y coros · 12 bolos · 1 EP grabado' },
            { yrs: '2022', t: 'Eléctrica Sur', d: 'Banda tributo · 6 meses' },
            { yrs: '2020–21', t: 'Escuela Municipal Suzuki', d: 'Formación clásica contrabajo' },
          ].map((x, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 16, padding: '12px 0', borderTop: i > 0 ? `1px solid ${T.line}` : 'none' }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.accent, letterSpacing: 1 }}>{x.yrs}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{x.t}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{x.d}</div>
              </div>
            </div>
          ))}

          <Meta items={['AMIGOS EN COMÚN']} style={{ marginBottom: 14, marginTop: 28 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {['Dani K', 'Laura M', 'Álex R'].map((n, i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={n} size={32} tone={['amber','green','plum'][i]} />
                <span style={{ fontSize: 12 }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHAT ──────────────────────────────────────────
function Chat() {
  const conversations = [
    { n: 'Marta V.', last: 'ok, ¿el sábado a las 18?', time: '2min', unread: 2, tone: 'plum', active: true },
    { n: 'Los Perros Verdes', last: 'te mandamos la demo adjunta', time: '1h', unread: 0, tone: 'ink' },
    { n: 'Sala Siroco', last: 'Reserva confirmada para el 27', time: '3h', unread: 0, tone: 'amber' },
    { n: 'Dani K.', last: 'mira esta batería, brutal', time: 'Ayer', unread: 0, tone: 'green' },
    { n: 'Estudios Bemol', last: 'dispone sala 3 de 19 a 22h', time: '2d', unread: 0, tone: 'blue' },
    { n: 'Laura M.', last: '🎹 pasamos el sample?', time: '4d', unread: 0, tone: 'plum' },
  ];

  const msgs = [
    { from: 'them', t: 'Ey Iván! vi tu perfil, me mola mucho lo que propones 👁', time: '14:22' },
    { from: 'me', t: 'Hey Marta! Igualmente, escuché el sample de Humedad, que vicio de bajo', time: '14:25' },
    { from: 'them', t: 'jaja gracias! cuándo te iría bien vernos? tengo local en Legazpi', time: '14:26' },
    { from: 'me', t: 'De lujo. El sábado por la tarde?', time: '14:28' },
    { from: 'them', type: 'suggest', time: '14:28' },
    { from: 'them', t: 'ok, ¿el sábado a las 18?', time: '14:30' },
  ];

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink, display: 'grid', gridTemplateColumns: '300px 1fr 260px' }}>
      {/* list */}
      <div style={{ background: T.white, borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Wordmark size={18} />
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: 1 }}>INBOX · 2</span>
        </div>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: T.muted }}>{Icons.search(13)}</span>
          <input placeholder="Buscar..." style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, flex: 1, fontFamily: T.sans }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {conversations.map((c, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 10, padding: '14px 16px',
              borderBottom: `1px solid ${T.line}`, background: c.active ? T.paper2 : 'transparent', cursor: 'pointer',
            }}>
              <Avatar name={c.n} size={40} tone={c.tone} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: c.unread ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.n}</div>
                <div style={{ fontSize: 12, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{c.last}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted }}>{c.time}</div>
                {c.unread > 0 && <span style={{ display: 'inline-block', marginTop: 4, background: T.accent, color: T.paper, fontSize: 9, fontFamily: T.mono, padding: '2px 5px', borderRadius: 8 }}>{c.unread}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* thread */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.paper }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name="Marta V" tone="plum" size={38} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Marta Vilches</div>
              <Meta items={['BAJO', 'LAVAPIÉS', 'EN LÍNEA']} style={{ marginTop: 1 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn variant="ghost" size="sm">Ver perfil</Btn>
            <Btn variant="primary" size="sm">Proponer ensayo</Btn>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: T.paper }}>
          <div style={{ textAlign: 'center', fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 20 }}>— HOY · 14:22 —</div>
          {msgs.map((m, i) => {
            if (m.type === 'suggest') return (
              <div key={i} style={{ margin: '8px 0', display: 'flex' }}>
                <div style={{ background: T.ink, color: T.paper, padding: 14, maxWidth: 340, border: `1px solid ${T.ink}` }}>
                  <Meta items={['★ PROPUESTA DE ENSAYO']} style={{ color: T.accentSoft, marginBottom: 8 }} />
                  <div style={{ fontFamily: T.serif, fontSize: 20, letterSpacing: -0.3 }}>Sábado 26 abr · 18:00</div>
                  <Meta items={['ESTUDIOS BEMOL', 'SALA 3', '2H · 30€']} style={{ color: '#c9c1b4', marginTop: 6 }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button style={{ padding: '6px 12px', background: T.accent, color: T.paper, border: 'none', fontSize: 11, fontFamily: T.mono, letterSpacing: 1, cursor: 'pointer' }}>ACEPTAR</button>
                    <button style={{ padding: '6px 12px', background: 'transparent', color: T.paper, border: `1px solid #3a332c`, fontSize: 11, fontFamily: T.mono, letterSpacing: 1, cursor: 'pointer' }}>PROPONER OTRA</button>
                  </div>
                </div>
              </div>
            );
            return (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start', margin: '6px 0' }}>
                <div style={{
                  maxWidth: 420, padding: '10px 14px',
                  background: m.from === 'me' ? T.ink : T.white,
                  color: m.from === 'me' ? T.paper : T.ink,
                  border: m.from === 'me' ? 'none' : `1px solid ${T.line}`,
                  fontSize: 14, lineHeight: 1.4,
                }}>
                  {m.t}
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: m.from === 'me' ? '#c9c1b4' : T.muted, marginTop: 4, textAlign: 'right', letterSpacing: 0.5 }}>{m.time}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${T.line}`, background: T.white, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={{ width: 32, height: 32, border: `1px solid ${T.line2}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icons.plus(13)}</button>
          <input placeholder="Escribe un mensaje..." style={{ flex: 1, border: `1px solid ${T.line2}`, padding: '10px 12px', outline: 'none', fontFamily: T.sans, fontSize: 14, background: T.paper }} />
          <button style={{ padding: '10px 14px', background: T.accent, color: T.paper, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.mono, fontSize: 11, letterSpacing: 1 }}>{Icons.send(12)} ENVIAR</button>
        </div>
      </div>

      {/* right: profile preview */}
      <div style={{ background: T.paper2, borderLeft: `1px solid ${T.line}`, padding: '20px', overflow: 'auto' }}>
        <PhotoPlaceholder tone="plum" style={{ height: 140 }} label="marta" />
        <div style={{ fontFamily: T.serif, fontSize: 22, letterSpacing: -0.3, marginTop: 12 }}>Marta Vilches</div>
        <Meta items={['BAJO · LV.4']} style={{ marginTop: 2 }} />
        <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
          <Tag>POST-PUNK</Tag><Tag>SHOEGAZE</Tag><Tag>FINDES</Tag>
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
          <Meta items={['COMPARTÍS']} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.6 }}>
            · 4 influencias (Slowdive, IDLES...)<br/>
            · Zona Lavapiés<br/>
            · Disponibilidad fines de semana<br/>
            · 3 amigos en común
          </div>
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
          <Meta items={['ARCHIVOS']} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: `1px solid ${T.line}`, background: T.white, fontSize: 12 }}>
            <span style={{ color: T.accent }}>{Icons.play(13)}</span>
            <span style={{ flex: 1 }}>humedad-demo.mp3</span>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>2:43</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Search = Search;
window.MusicianProfile = MusicianProfile;
window.Chat = Chat;
