// Home v2 — vinyl edition, no swipe, no audio samples
const T = window.BY_TOKENS;

function Home() {
  const [tab, setTab] = React.useState('cerca');

  const musicians = [
    { id: 1, name: 'Marta Vilches', role: 'Bajo · Voz', tone: 'plum', zone: 'Lavapiés', level: 'Avanzado', tags: ['POST-PUNK', 'SHOEGAZE', 'FINDES'], bio: 'Ex de Los Santos Vagos. Busco proyecto con material propio.', shared: ['Slowdive', 'IDLES', 'Viva Belgrado', '+1 más'] },
    { id: 2, name: 'Dani K.', role: 'Batería', tone: 'amber', zone: 'Malasaña', level: 'Pro', tags: ['INDIE', 'KRAUT', 'FLEXIBLE'], bio: 'Toco desde los 14. Abierto a jams y proyectos con vista larga.', shared: ['Fontaines D.C.', 'La Plata', '+2 más'] },
    { id: 3, name: 'Laura M.', role: 'Sintetizadores', tone: 'green', zone: 'Tetuán', level: 'Intermedio', tags: ['SYNTH-POP', 'AMBIENT'], bio: 'Produzco en casa, quiero llevar lo mío a directo.', shared: ['Carolina Durante', '+1 más'] },
  ];

  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink, display: 'flex' }}>
      {/* SIDEBAR */}
      <div style={{ width: 220, background: T.white, borderRight: `1px solid ${T.line}`, padding: '24px 18px', display: 'flex', flexDirection: 'column' }}>
        <Wordmark size={22} />
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { i: Icons.home, l: 'Inicio', active: true },
            { i: Icons.compass, l: 'Directorio' },
            { i: Icons.map, l: 'Mapa' },
            { i: Icons.calendar, l: 'Agenda' },
            { i: Icons.ticket, l: 'Espacios' },
            { i: Icons.chat, l: 'Mensajes', badge: 3 },
            { i: Icons.heart, l: 'Guardados' },
          ].map((n, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
              fontFamily: T.cond, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
              color: n.active ? T.ink : T.ink3, cursor: 'pointer',
              background: n.active ? T.paper2 : 'transparent',
              borderLeft: n.active ? `2px solid ${T.accent}` : '2px solid transparent',
              fontWeight: n.active ? 500 : 400,
            }}>
              <span style={{ color: n.active ? T.accent : T.muted }}>{n.i(15)}</span>
              <span style={{ flex: 1 }}>{n.l}</span>
              {n.badge && <span style={{ background: T.accent, color: T.cream, fontSize: 10, fontFamily: T.mono, padding: '1px 5px' }}>{n.badge}</span>}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '12px', background: T.paper2, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name="Iván T" tone="ink" size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Iván T.</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, letterSpacing: 0.8 }}>GUITARRA · LV.4</div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '20px 32px', borderBottom: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.paper }}>
          <div>
            <Meta items={['JUEVES · 23 ABR', 'MADRID']} style={{ marginBottom: 6 }} />
            <div style={{ fontFamily: T.display, fontSize: 40, letterSpacing: -1, fontWeight: 600 }}>Buenas, <span style={{ fontStyle: 'italic', fontWeight: 400 }}>Iván</span>.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: `1px solid ${T.ink}`, background: T.white, width: 280 }}>
              <span style={{ color: T.muted }}>{Icons.search(14)}</span>
              <input placeholder="Buscar músicos, bandas, espacios..." style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontFamily: T.sans, fontSize: 13 }} />
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, letterSpacing: 1 }}>⌘K</span>
            </div>
            <Btn variant="primary" size="md" icon={Icons.plus(13)}>Publicar</Btn>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', overflow: 'auto' }}>
            {/* tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.line}`, marginBottom: 24 }}>
              {[
                { id: 'cerca', l: 'Cerca de ti' },
                { id: 'afines', l: 'Afines a tu estilo' },
                { id: 'nuevos', l: 'Nuevos perfiles' },
                { id: 'bandas', l: 'Bandas con vacante' },
              ].map(tb => (
                <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                  background: 'none', border: 'none', padding: '12px 18px', cursor: 'pointer',
                  fontFamily: T.cond, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase',
                  color: tab === tb.id ? T.ink : T.muted,
                  borderBottom: `2px solid ${tab === tb.id ? T.accent : 'transparent'}`,
                  marginBottom: -1, fontWeight: tab === tb.id ? 600 : 400,
                }}>{tb.l}</button>
              ))}
            </div>

            {/* feature card: looking for you */}
            <div style={{
              background: T.ink, color: T.cream, padding: '28px', marginBottom: 24,
              position: 'relative', overflow: 'hidden',
              display: 'grid', gridTemplateColumns: '1fr 200px', gap: 28, alignItems: 'center',
            }}>
              <div>
                <Meta items={['★ DESTACADO HOY', 'MADRID']} style={{ color: T.accent, marginBottom: 12 }} />
                <div style={{ fontFamily: T.display, fontSize: 42, lineHeight: 1, letterSpacing: -1, fontWeight: 600 }}>
                  Los <span style={{ fontStyle: 'italic', fontWeight: 400 }}>Perros Verdes</span><br/>
                  publican <span style={{ color: T.accent }}>vacante.</span>
                </div>
                <p style={{ fontSize: 13, color: '#c9bfa4', marginTop: 14, maxWidth: 440 }}>
                  Post-punk con base en Lavapiés. Ensayan los martes. Coinciden en 3 de tus influencias.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <Btn variant="accent" size="md">Ver banda</Btn>
                  <Btn variant="ghost" size="md" style={{ color: T.cream, borderColor: '#3a332c' }}>Descartar</Btn>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Vinyl size={180} tone="plum" label="Perros Verdes" sublabel="Side A · 45" />
              </div>
            </div>

            <Meta items={['MÚSICOS CERCA', 'ORDENADOS POR CERCANÍA']} style={{ marginBottom: 14 }} />

            {/* Musician cards — catalog style */}
            <div style={{ display: 'grid', gap: 12 }}>
              {musicians.map(m => (
                <div key={m.id} style={{
                  background: T.white, border: `1px solid ${T.line}`, padding: 0,
                  display: 'grid', gridTemplateColumns: '100px 1fr auto',
                }}>
                  <div style={{ background: T.ink, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Vinyl size={70} tone={m.tone} label={m.name.split(' ')[0]} sublabel={m.role.split(' ')[0]} />
                  </div>
                  <div style={{ padding: '16px 20px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: T.display, fontSize: 24, letterSpacing: -0.5, fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: 1 }}>· {m.role.toUpperCase()} · LV. {m.level.toUpperCase()}</span>
                    </div>
                    <Meta items={[m.zone.toUpperCase(), ...m.tags]} style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: 13, color: T.ink2, margin: 0, lineHeight: 1.4 }}>{m.bio}</p>
                    <div style={{ marginTop: 10, fontSize: 11, color: T.muted, fontFamily: T.mono, letterSpacing: 0.5 }}>
                      COMPARTÍS: <span style={{ color: T.ink }}>{m.shared.join(' · ')}</span>
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', justifyContent: 'space-between', borderLeft: `1px dashed ${T.line}` }}>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: 1 }}>{m.zone.toUpperCase()}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant="ghost" size="sm">Ver ficha</Btn>
                      <Btn variant="primary" size="sm">Escribir</Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bandas con vacante */}
            <div style={{ marginTop: 36 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, borderBottom: `1px solid ${T.ink}`, paddingBottom: 10 }}>
                <div style={{ fontFamily: T.display, fontSize: 32, letterSpacing: -0.5, fontWeight: 600 }}>
                  Bandas <span style={{ fontStyle: 'italic', fontWeight: 400 }}>con vacante</span>
                </div>
                <Meta items={['VER TODAS →']} style={{ cursor: 'pointer' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { name: 'Carrión', need: '+ Teclados', style: 'Shoegaze', zone: 'Malasaña', tone: 'plum' },
                  { name: 'Nieve Roja', need: '+ Voz', style: 'Hardcore', zone: 'Carabanchel', tone: 'amber' },
                  { name: 'La Tormenta', need: '+ Batería', style: 'Indie', zone: 'La Latina', tone: 'green' },
                ].map((b, i) => (
                  <div key={i} style={{ background: T.white, border: `1px solid ${T.line}`, padding: 14 }}>
                    <Sleeve tone={b.tone} style={{ height: 150, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Vinyl size={110} tone={b.tone} label={b.name} sublabel={b.style} />
                    </Sleeve>
                    <div style={{ fontFamily: T.display, fontSize: 20, letterSpacing: -0.3, fontWeight: 600 }}>{b.name}</div>
                    <Meta items={[b.style.toUpperCase(), b.zone.toUpperCase()]} style={{ marginTop: 2 }} />
                    <div style={{ marginTop: 10 }}><Tag variant="accent">{b.need}</Tag></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* right rail: agenda */}
          <div style={{ background: T.paper2, borderLeft: `1px solid ${T.line}`, padding: '24px 20px', overflow: 'auto' }}>
            <Meta items={['ESTA SEMANA EN MADRID']} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: T.display, fontSize: 26, letterSpacing: -0.3, fontWeight: 600, marginBottom: 14 }}>
              Agenda <span style={{ fontStyle: 'italic', fontWeight: 400 }}>abierta</span>
            </div>
            {[
              { d: '23', m: 'ABR', t: 'Jam indie', p: 'Wurlitzer', h: '22:00', kind: 'JAM' },
              { d: '25', m: 'ABR', t: 'Open stage', p: 'El Sol', h: '21:30', kind: 'OPEN' },
              { d: '26', m: 'ABR', t: 'Los Perros Verdes', p: 'Siroco', h: '21:00', kind: 'BOLO' },
              { d: '27', m: 'ABR', t: 'Jazz night', p: 'Bogui', h: '20:00', kind: 'JAM' },
            ].map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 12, padding: '14px 0', borderTop: i > 0 ? `1px solid ${T.line}` : 'none', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', padding: '6px 0', background: T.white, border: `1px solid ${T.ink}` }}>
                  <div style={{ fontFamily: T.display, fontSize: 22, lineHeight: 1, fontWeight: 600 }}>{e.d}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, letterSpacing: 1 }}>{e.m}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.t}</div>
                  <Meta items={[e.p, e.h]} style={{ marginTop: 2 }} />
                </div>
                <Tag>{e.kind}</Tag>
              </div>
            ))}

            <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
              <Meta items={['MENSAJES RECIENTES']} style={{ marginBottom: 12 }} />
              {[
                { n: 'Marta V.', last: '¿el sábado a las 18?', unread: 2, tone: 'plum' },
                { n: 'Los Perros Verdes', last: 'nos interesa tu perfil', unread: 1, tone: 'ink' },
                { n: 'Sala Siroco', last: 'reserva confirmada', unread: 0, tone: 'amber' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                  <Avatar name={c.n} size={32} tone={c.tone} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.n}</div>
                    <div style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last}</div>
                  </div>
                  {c.unread > 0 && <span style={{ background: T.accent, color: T.cream, fontSize: 10, fontFamily: T.mono, padding: '1px 5px' }}>{c.unread}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.Home = Home;
