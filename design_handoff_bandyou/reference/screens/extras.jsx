// Map, Events, Rehearsal Space
const T = window.BY_TOKENS;

// ─── MAP ──────────────────────────────────────────
function MapScene() {
  const [selected, setSelected] = React.useState(2);
  const [layer, setLayer] = React.useState('all');

  const pins = [
    { id: 1, x: 30, y: 40, t: 'musician', n: 'Dani K.', s: 'Batería · Malasaña' },
    { id: 2, x: 48, y: 58, t: 'musician', n: 'Marta Vilches', s: 'Bajo · Lavapiés', highlight: true },
    { id: 3, x: 65, y: 48, t: 'band', n: 'Los Perros Verdes', s: 'Post-punk · busca batería' },
    { id: 4, x: 40, y: 70, t: 'venue', n: 'Estudios Bemol', s: 'Local · 15€/h' },
    { id: 5, x: 72, y: 30, t: 'event', n: 'Jam Indie', s: 'Wurlitzer · jueves 22h' },
    { id: 6, x: 25, y: 62, t: 'teacher', n: 'Carlos Ruiz', s: 'Profe guitarra · 25€/h' },
    { id: 7, x: 55, y: 32, t: 'musician', n: 'Laura M.', s: 'Synth · Tetuán' },
    { id: 8, x: 78, y: 65, t: 'venue', n: 'Sala Costello', s: 'Local · 18€/h' },
    { id: 9, x: 38, y: 24, t: 'event', n: 'Open Stage', s: 'El Sol · sábado' },
  ];

  const typeColor = { musician: T.accent, band: T.plum, venue: T.ink, event: T.green, teacher: T.blue };
  const sel = pins.find(p => p.id === selected);

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 32px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Wordmark size={18} />
          <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1, color: T.muted }}>/ MAPA DE LA ESCENA · MADRID</span>
        </div>
        <Meta items={['3.241 ACTIVOS', 'ACTUALIZADO HACE 2 MIN']} />
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px' }}>
        {/* map */}
        <div style={{ position: 'relative', background: T.paper2, overflow: 'hidden', borderRight: `1px solid ${T.line}` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block', position: 'absolute', inset: 0 }}>
            {/* abstract Madrid map */}
            <defs>
              <pattern id="dots" width="3" height="3" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="0.3" fill={T.line2} />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#dots)" />
            {/* roads */}
            <path d="M 0 50 Q 30 48 50 52 T 100 50" stroke={T.line2} strokeWidth="0.4" fill="none" />
            <path d="M 50 0 Q 52 30 48 50 T 50 100" stroke={T.line2} strokeWidth="0.4" fill="none" />
            <path d="M 10 10 Q 40 30 60 20 T 90 30" stroke={T.line2} strokeWidth="0.3" fill="none" />
            <path d="M 15 80 Q 40 70 60 80 T 95 75" stroke={T.line2} strokeWidth="0.3" fill="none" />
            {/* river */}
            <path d="M 5 65 Q 20 70 25 85 T 35 100" stroke="#b8c8d4" strokeWidth="1.2" fill="none" opacity="0.6" />
            {/* parks */}
            <ellipse cx="70" cy="45" rx="8" ry="6" fill={T.green} opacity="0.12" />
            <ellipse cx="20" cy="30" rx="5" ry="4" fill={T.green} opacity="0.12" />
            {/* zone labels */}
            <text x="30" y="45" fontFamily={T.mono} fontSize="1.5" fill={T.muted} letterSpacing="0.3">MALASAÑA</text>
            <text x="48" y="62" fontFamily={T.mono} fontSize="1.5" fill={T.muted} letterSpacing="0.3">LAVAPIÉS</text>
            <text x="60" y="32" fontFamily={T.mono} fontSize="1.5" fill={T.muted} letterSpacing="0.3">CHAMBERÍ</text>
            <text x="25" y="72" fontFamily={T.mono} fontSize="1.5" fill={T.muted} letterSpacing="0.3">LA LATINA</text>
          </svg>

          {/* pins */}
          {pins.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)} style={{
              position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -100%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>
              <div style={{
                background: typeColor[p.t], color: T.paper,
                padding: '4px 8px', fontFamily: T.mono, fontSize: 10, letterSpacing: 1,
                border: `${selected === p.id ? 2 : 1}px solid ${T.ink}`,
                whiteSpace: 'nowrap', boxShadow: selected === p.id ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                transform: selected === p.id ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.15s',
              }}>{p.n.toUpperCase()}</div>
              <div style={{
                width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                borderTop: `8px solid ${T.ink}`, margin: '0 auto',
              }}/>
            </button>
          ))}

          {/* legend */}
          <div style={{ position: 'absolute', bottom: 20, left: 20, background: T.white, border: `1px solid ${T.line2}`, padding: '12px 14px' }}>
            <Meta items={['LEYENDA']} style={{ marginBottom: 8 }} />
            {[
              { t: 'all', l: 'Todos' },
              { t: 'musician', l: 'Músicos' },
              { t: 'band', l: 'Bandas' },
              { t: 'venue', l: 'Locales' },
              { t: 'event', l: 'Eventos' },
              { t: 'teacher', l: 'Profes' },
            ].map(x => (
              <div key={x.t} onClick={() => setLayer(x.t)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer',
                opacity: layer === 'all' || layer === x.t ? 1 : 0.4,
              }}>
                <div style={{ width: 10, height: 10, background: x.t === 'all' ? T.muted : typeColor[x.t] }} />
                <span style={{ fontSize: 11 }}>{x.l}</span>
              </div>
            ))}
          </div>

          {/* zoom */}
          <div style={{ position: 'absolute', top: 20, right: 20, background: T.white, border: `1px solid ${T.line2}`, display: 'flex', flexDirection: 'column' }}>
            <button style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `1px solid ${T.line}` }}>+</button>
            <button style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }}>−</button>
          </div>
        </div>

        {/* side panel */}
        <div style={{ padding: '20px', overflow: 'auto' }}>
          {sel && (
            <div>
              <PhotoPlaceholder tone={sel.t === 'band' ? 'plum' : sel.t === 'venue' ? 'ink' : 'amber'} style={{ height: 140 }} label={sel.n} />
              <Meta items={[sel.t.toUpperCase(), 'MADRID']} style={{ marginTop: 12 }} />
              <div style={{ fontFamily: T.serif, fontSize: 28, letterSpacing: -0.4, marginTop: 4 }}>{sel.n}</div>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 4 }}>{sel.s}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <Btn variant="primary" size="sm" style={{ flex: 1 }}>Ver perfil</Btn>
                <Btn variant="ghost" size="sm" icon={Icons.chat(12)}>Saludar</Btn>
              </div>
            </div>
          )}

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.line}` }}>
            <Meta items={['CERCA DE ESTE PIN']} style={{ marginBottom: 12 }} />
            {pins.filter(p => p.id !== selected).slice(0, 4).map(p => (
              <div key={p.id} onClick={() => setSelected(p.id)} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: `1px solid ${T.line}`, cursor: 'pointer' }}>
                <div style={{ width: 6, height: 6, background: typeColor[p.t], marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.n}</div>
                  <div style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EVENTS ──────────────────────────────────────────
function Events() {
  const evts = [
    { d: '23', m: 'ABR', day: 'JUE', t: 'Jam Night Indie', p: 'Wurlitzer Ballroom', zone: 'Centro', h: '22:00', price: 'Gratis', tone: 'plum', tags: ['INDIE', 'ABIERTA', '12/20'], feat: true },
    { d: '25', m: 'ABR', day: 'SÁB', t: 'Open Stage · Singer-Songwriter', p: 'Sala El Sol', zone: 'Centro', h: '21:30', price: '5€', tone: 'amber', tags: ['FOLK', 'ACÚSTICO', '8/15'] },
    { d: '26', m: 'ABR', day: 'DOM', t: 'Domingo de Blues', p: 'Café Central', zone: 'Sol', h: '19:00', price: '8€', tone: 'blue', tags: ['BLUES', 'JAM'] },
    { d: '27', m: 'ABR', day: 'LUN', t: 'Jazz Night', p: 'Bogui Jazz', zone: 'Chueca', h: '20:00', price: '10€', tone: 'ink', tags: ['JAZZ', '4/10 ABIERTAS'] },
    { d: '30', m: 'ABR', day: 'JUE', t: 'Ensayo abierto · Hardcore', p: 'Nave 73', zone: 'Legazpi', h: '19:00', price: 'Gratis', tone: 'amber', tags: ['HARDCORE', 'ABIERTA'] },
    { d: '02', m: 'MAY', day: 'SÁB', t: 'Festival BandYou · 1º aniversario', p: 'La Riviera', zone: 'Centro', h: '20:00', price: '15€', tone: 'plum', tags: ['★ ANIVERSARIO', '8 BANDAS'], feat: true },
  ];

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink, padding: '32px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <Meta items={['AGENDA', 'MADRID', 'ABRIL 2026']} style={{ marginBottom: 8 }} />
          <h1 style={{ fontFamily: T.serif, fontSize: 72, letterSpacing: -1.5, margin: 0, fontWeight: 400, lineHeight: 0.95 }}>
            Jams, bolos,<br/><span style={{ fontStyle: 'italic', color: T.accent }}>open stages.</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="ghost" size="sm">Esta semana</Btn>
          <Btn variant="ghost" size="sm">Mes</Btn>
          <Btn variant="primary" size="sm" icon={Icons.plus(13)}>Publicar evento</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {evts.map((e, i) => (
          <div key={i} style={{
            background: e.feat ? T.ink : T.white,
            color: e.feat ? T.paper : T.ink,
            border: `1px solid ${e.feat ? T.ink : T.line}`,
            padding: 0, display: 'grid', gridTemplateColumns: '120px 1fr', overflow: 'hidden',
          }}>
            <div style={{
              background: e.feat ? T.accent : T.paper2,
              color: e.feat ? T.paper : T.ink,
              padding: 20, textAlign: 'center', borderRight: `1px solid ${e.feat ? T.accent2 : T.line}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1, opacity: 0.7 }}>{e.day}</div>
              <div style={{ fontFamily: T.serif, fontSize: 52, lineHeight: 1, margin: '4px 0' }}>{e.d}</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 2 }}>{e.m}</div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${e.feat ? T.accent2 : T.line}`, fontFamily: T.mono, fontSize: 10 }}>{e.h}</div>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 24, letterSpacing: -0.4, lineHeight: 1.1 }}>{e.t}</div>
                <Meta items={[e.p.toUpperCase(), e.zone.toUpperCase(), e.price.toUpperCase()]} style={{ color: e.feat ? '#c9c1b4' : T.muted, marginTop: 6 }} />
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {e.tags.map(tg => (
                    <span key={tg} style={{
                      fontFamily: T.mono, fontSize: 9, padding: '3px 6px',
                      border: `1px solid ${e.feat ? '#3a332c' : T.line2}`,
                      color: e.feat ? T.paper : T.ink2, letterSpacing: 1,
                    }}>{tg}</span>
                  ))}
                </div>
                <Btn variant={e.feat ? 'accent' : 'primary'} size="sm">Apuntarme</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── REHEARSAL SPACE ──────────────────────────────────
function Rehearsal() {
  const slots = [
    { d: 'LUN', date: '22', blocks: ['□', '□', '■', '■', '□', '□', '□'] },
    { d: 'MAR', date: '23', blocks: ['□', '■', '■', '□', '□', '□', '■'] },
    { d: 'MIÉ', date: '24', blocks: ['■', '■', '□', '□', '□', '□', '□'] },
    { d: 'JUE', date: '25', blocks: ['□', '□', '□', '□', '□', '■', '■'] },
    { d: 'VIE', date: '26', blocks: ['□', '□', '■', '□', '□', '□', '□'] },
    { d: 'SÁB', date: '27', blocks: ['□', '□', '□', '●', '●', '■', '■'] },
    { d: 'DOM', date: '28', blocks: ['□', '□', '□', '□', '□', '□', '■'] },
  ];
  const hours = ['10', '12', '14', '16', '18', '20', '22'];

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink, overflow: 'auto' }}>
      <div style={{ padding: '16px 40px', borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink, display: 'flex' }}>{Icons.back(16)}</button>
          <Wordmark size={18} />
        </div>
        <Meta items={['LOCAL DE ENSAYO', 'LEGAZPI']} />
      </div>

      <div style={{ padding: '40px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40 }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 4, marginBottom: 16 }}>
            <PhotoPlaceholder tone="ink" style={{ height: 260 }} label="sala 3" />
            <PhotoPlaceholder tone="ink" style={{ height: 128 }} label="batería" />
            <PhotoPlaceholder tone="ink" style={{ height: 128 }} label="amps" />
            <PhotoPlaceholder tone="ink" style={{ height: 128, gridColumn: '2 / 4' }} label="mesa" />
          </div>

          <Meta items={['LOCAL DE ENSAYO · LEGAZPI']} style={{ marginBottom: 10 }} />
          <h1 style={{ fontFamily: T.serif, fontSize: 56, letterSpacing: -1, margin: 0, fontWeight: 400, lineHeight: 0.95 }}>
            Estudios <span style={{ fontStyle: 'italic' }}>Bemol</span>
          </h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            <Tag active>15€/H</Tag><Tag>5 SALAS</Tag><Tag>BATERÍA</Tag><Tag>P.A. INCLUIDO</Tag><Tag>PARKING</Tag>
          </div>
          <p style={{ fontSize: 15, color: T.ink2, lineHeight: 1.6, marginTop: 20, maxWidth: 540 }}>
            Tres salas insonorizadas en pleno Legazpi, a 5 min del metro. Abrimos de 10 a 02h todos los días.
            Incluye batería Mapex, ampli de bajo Ampex SVT-3 y guitarra Fender Hot Rod. Grabación por 40€/h adicionales.
          </p>

          <div style={{ marginTop: 28 }}>
            <Meta items={['DISPONIBILIDAD · SEMANA 22-28 ABR']} style={{ marginBottom: 12 }} />
            <div style={{ background: T.white, border: `1px solid ${T.line}`, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                <div />
                {slots.map(s => (
                  <div key={s.d} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, letterSpacing: 1 }}>{s.d}</div>
                    <div style={{ fontFamily: T.serif, fontSize: 18 }}>{s.date}</div>
                  </div>
                ))}
              </div>
              {hours.map((h, hi) => (
                <div key={h} style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', gap: 4, marginTop: 4 }}>
                  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, textAlign: 'right', paddingRight: 6, lineHeight: '28px' }}>{h}h</div>
                  {slots.map((s, si) => {
                    const b = s.blocks[hi];
                    const bg = b === '■' ? T.line2 : b === '●' ? T.accent : T.paper;
                    const color = b === '●' ? T.paper : T.ink3;
                    return (
                      <div key={si} style={{
                        height: 28, background: bg, color,
                        border: `1px solid ${b === '■' ? T.line2 : T.line}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: T.mono, fontSize: 9, cursor: b === '■' ? 'not-allowed' : 'pointer',
                        letterSpacing: 1,
                      }}>{b === '●' ? 'TÚ' : b === '■' ? '' : ''}</div>
                    );
                  })}
                </div>
              ))}
              <div style={{ marginTop: 14, display: 'flex', gap: 16, fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: 0.5 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: T.paper, border: `1px solid ${T.line2}`, marginRight: 6, verticalAlign: 'middle' }}/>LIBRE</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: T.line2, marginRight: 6, verticalAlign: 'middle' }}/>OCUPADO</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: T.accent, marginRight: 6, verticalAlign: 'middle' }}/>TU SELECCIÓN</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ background: T.ink, color: T.paper, padding: 24 }}>
            <Meta items={['RESERVA']} style={{ color: T.accentSoft, marginBottom: 14 }} />
            <div style={{ fontFamily: T.serif, fontSize: 32, letterSpacing: -0.5 }}>Sábado 27 abr</div>
            <div style={{ fontSize: 14, color: '#c9c1b4', marginTop: 2 }}>Sala 3 · 16:00 – 18:00</div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid #3a332c` }}>
              {[
                { l: '2 horas · sala 3', v: '30,00 €' },
                { l: 'Grabación multipista', v: '—' },
                { l: 'Tasas', v: 'incluidas' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: '#c9c1b4' }}>
                  <span>{r.l}</span><span style={{ fontFamily: T.mono }}>{r.v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 6, borderTop: `1px solid #3a332c`, fontFamily: T.serif, fontSize: 24 }}>
                <span>Total</span><span>30,00 €</span>
              </div>
            </div>
            <Btn variant="accent" size="lg" style={{ width: '100%', marginTop: 16 }}>Reservar ahora</Btn>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, textAlign: 'center', marginTop: 10, letterSpacing: 0.5 }}>CANCELACIÓN GRATIS HASTA 24H ANTES</div>
          </div>

          <div style={{ marginTop: 20 }}>
            <Meta items={['EQUIPAMIENTO']} style={{ marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {['Batería Mapex', 'Ampli Ampeg', 'Ampli Fender', 'P.A. 800W', '4 mics SM58', 'Mesa Yamaha'].map(x => (
                <div key={x} style={{ padding: 10, border: `1px solid ${T.line}`, background: T.white, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: T.accent }}>{Icons.check(12)}</span>{x}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.line}` }}>
            <Meta items={['DUEÑO']} style={{ marginBottom: 10 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name="Raúl Hernández" tone="amber" size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Raúl Hernández</div>
                <Meta items={['RESPONDE EN ~20 MIN', '★ 4.9']} />
              </div>
              <Btn variant="ghost" size="sm" icon={Icons.chat(12)}>Msg</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.MapScene = MapScene;
window.Events = Events;
window.Rehearsal = Rehearsal;
