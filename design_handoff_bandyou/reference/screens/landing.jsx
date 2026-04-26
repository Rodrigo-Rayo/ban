// Landing v2 — vinyl edition
const T = window.BY_TOKENS;

function Landing() {
  return (
    <div style={{ background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink, overflow: 'hidden', position: 'relative' }}>
      {/* grain overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, mixBlendMode: 'multiply',
        background: 'radial-gradient(ellipse at 20% 10%, rgba(139,90,43,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(90,60,30,0.06) 0%, transparent 50%)',
      }}/>

      {/* NAV */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 44px', borderBottom: `1px solid ${T.line}`, position: 'relative' }}>
        <Wordmark size={24} />
        <div style={{ display: 'flex', gap: 32, fontSize: 13, fontFamily: T.cond, letterSpacing: 1.4, textTransform: 'uppercase', color: T.ink2 }}>
          <span style={{ cursor: 'pointer' }}>Músicos</span>
          <span style={{ cursor: 'pointer' }}>Bandas</span>
          <span style={{ cursor: 'pointer' }}>Espacios</span>
          <span style={{ cursor: 'pointer' }}>Profes</span>
          <span style={{ cursor: 'pointer' }}>Agenda</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="text" size="sm">Entrar</Btn>
          <Btn variant="primary" size="sm">Unirse</Btn>
        </div>
      </div>

      {/* HERO */}
      <div style={{ padding: '56px 44px 20px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 60, alignItems: 'center' }}>
          <div>
            <Meta items={['LADO A', 'MADRID · EST. 2026', 'CARA ABIERTA']} style={{ marginBottom: 28 }} />
            <h1 style={{
              fontFamily: T.display, fontSize: 132, lineHeight: 0.88, margin: 0,
              letterSpacing: -4, color: T.ink, fontWeight: 600,
            }}>
              La escena<br/>
              <span style={{ fontStyle: 'italic', fontWeight: 400 }}>suena mejor</span><br/>
              cuando <span style={{ color: T.accent }}>conecta.</span>
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.5, color: T.ink2, marginTop: 28, maxWidth: 540 }}>
              BandYou es el directorio vivo de la música en Madrid. Músicos, bandas, salas de conciertos,
              locales de ensayo, estudios, profesores y eventos. Un mismo sitio, una agenda compartida.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 32, alignItems: 'center' }}>
              <Btn variant="accent" size="lg">Entrar en la escena</Btn>
              <Btn variant="ghost" size="lg">Explorar sin registro</Btn>
            </div>
            <Meta items={['GRATIS', 'ESPAÑA · EUROPA PRÓXIMAMENTE']} style={{ marginTop: 24 }} />
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Vinyl size={320} spin label="Side A" sublabel="Madrid · 33⅓" tone="amber" />
            <div style={{ position: 'absolute', top: -10, right: -20 }}>
              <Stamp rotate={-8} color={T.ink}>3.241 Perfiles</Stamp>
            </div>
            <div style={{ position: 'absolute', bottom: 20, left: -30 }}>
              <Stamp rotate={6}>Sin Algoritmo Tóxico</Stamp>
            </div>
          </div>
        </div>
      </div>

      {/* MARQUEE */}
      <div style={{ borderTop: `2px solid ${T.ink}`, borderBottom: `2px solid ${T.ink}`, background: T.ink, color: T.cream, overflow: 'hidden', padding: '18px 0', marginTop: 40 }}>
        <div style={{ display: 'flex', gap: 40, fontFamily: T.display, fontSize: 32, fontStyle: 'italic', whiteSpace: 'nowrap', animation: 'by-mq 50s linear infinite' }}>
          {Array.from({ length: 4 }).map((_, k) => (
            <React.Fragment key={k}>
              <span>Lavapiés</span><span style={{ color: T.accent }}>◆</span>
              <span>Malasaña</span><span style={{ color: T.accent }}>◆</span>
              <span>Vallekas</span><span style={{ color: T.accent }}>◆</span>
              <span>Chamberí</span><span style={{ color: T.accent }}>◆</span>
              <span>La Latina</span><span style={{ color: T.accent }}>◆</span>
              <span>Carabanchel</span><span style={{ color: T.accent }}>◆</span>
              <span>Tetuán</span><span style={{ color: T.accent }}>◆</span>
              <span>Chueca</span><span style={{ color: T.accent }}>◆</span>
            </React.Fragment>
          ))}
        </div>
        <style>{`@keyframes by-mq { from { transform: translateX(0);} to { transform: translateX(-25%);} }`}</style>
      </div>

      {/* CATALOG */}
      <div style={{ padding: '72px 44px', borderBottom: `1px solid ${T.line}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 40, alignItems: 'baseline', marginBottom: 32 }}>
          <div>
            <Meta items={['01', 'EL CATÁLOGO']} />
            <div style={{ fontFamily: T.cond, fontSize: 60, fontWeight: 300, letterSpacing: -1, lineHeight: 0.9, marginTop: 12, textTransform: 'uppercase' }}>
              Quién<br/>está<br/>dentro
            </div>
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.5, color: T.ink2, maxWidth: 560, paddingTop: 16 }}>
            Un mismo directorio para todo lo que hace falta para hacer música en una ciudad.
            Sin silos, sin apps separadas. Si existe en la escena, existe aquí.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderTop: `1px solid ${T.ink}`, borderLeft: `1px solid ${T.ink}` }}>
          {[
            { n: '01', l: 'Músicos', c: '3.241', tone: 'amber', d: 'De principiantes a pros.' },
            { n: '02', l: 'Bandas', c: '687', tone: 'plum', d: 'Formadas o en búsqueda.' },
            { n: '03', l: 'Espacios', c: '174', tone: 'ink', d: 'Salas · locales · estudios.' },
            { n: '04', l: 'Profesores', c: '156', tone: 'green', d: 'Clases y talleres.' },
            { n: '05', l: 'Agenda', c: '42/sem', tone: 'blue', d: 'Bolos, jams, open stages.' },
          ].map((c, i) => (
            <div key={i} style={{
              padding: '24px 20px', borderRight: `1px solid ${T.ink}`, borderBottom: `1px solid ${T.ink}`,
              background: T.paper, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 300,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, letterSpacing: 1.5 }}>{c.n}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: 1 }}>{c.c}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Vinyl size={120} tone={c.tone} label={c.l} sublabel={c.c} />
              </div>
              <div>
                <div style={{ fontFamily: T.display, fontSize: 28, letterSpacing: -0.5, fontWeight: 600 }}>{c.l}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{c.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW */}
      <div style={{ padding: '80px 44px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, borderBottom: `1px solid ${T.line}` }}>
        <div>
          <Meta items={['02', 'CARA B']} />
          <h2 style={{ fontFamily: T.display, fontSize: 80, letterSpacing: -2, margin: '16px 0 0', fontWeight: 600, lineHeight: 0.92 }}>
            Encuentras.<br/>
            <span style={{ fontStyle: 'italic', fontWeight: 400 }}>Hablas.</span><br/>
            <span style={{ color: T.accent }}>Tocas.</span>
          </h2>
          <p style={{ fontSize: 15, color: T.ink2, marginTop: 24, lineHeight: 1.6, maxWidth: 460 }}>
            Sin swipes. Sin gamificación. Buscas lo que necesitas, filtras por estilo, zona y nivel,
            y hablas directamente. Así de anticuado, así de honesto.
          </p>
        </div>
        <div>
          {[
            { n: '01', t: 'Creas tu ficha', d: 'Instrumento, estilos, influencias, zona, disponibilidad. Cinco minutos.' },
            { n: '02', t: 'Exploras el directorio', d: 'Filtros reales: bajistas de post-punk en Lavapiés con local los jueves.' },
            { n: '03', t: 'Mensaje directo', d: 'Nada de "me gusta" mutuo. Ves un perfil que encaja, escribes.' },
            { n: '04', t: 'Reserva compartida', d: 'Sala de ensayo, estudio o directo — el booking vive en el chat.' },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr', gap: 20, padding: '24px 0',
              borderTop: `1px solid ${T.line}`, alignItems: 'baseline',
            }}>
              <span style={{ fontFamily: T.display, fontSize: 36, color: T.accent, fontStyle: 'italic', fontWeight: 400 }}>{s.n}</span>
              <div>
                <div style={{ fontFamily: T.cond, fontSize: 22, letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase', fontWeight: 500 }}>{s.t}</div>
                <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SPACES FEATURE */}
      <div style={{ padding: '80px 44px', background: T.ink, color: T.cream }}>
        <Meta items={['03', 'ESPACIOS']} style={{ color: T.accent, marginBottom: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'end' }}>
          <h2 style={{ fontFamily: T.display, fontSize: 96, letterSpacing: -2.5, margin: 0, fontWeight: 600, lineHeight: 0.9 }}>
            Un <span style={{ fontStyle: 'italic', fontWeight: 400 }}>solo</span> mapa<br/>
            para <span style={{ color: T.accent }}>todo</span> lo que<br/>
            suena en Madrid.
          </h2>
          <p style={{ fontSize: 16, color: '#c9bfa4', lineHeight: 1.6, maxWidth: 400 }}>
            Salas de conciertos, locales de ensayo, estudios de grabación y tiendas de instrumentos.
            Reservas por hora, semana o para una gira. Con disponibilidad real y tarifas transparentes.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 48 }}>
          {[
            { t: 'Sala de conciertos', c: '38 espacios', s: 'Wurlitzer · El Sol · Siroco', tone: 'amber' },
            { t: 'Local de ensayo', c: '87 espacios', s: 'Por hora, mes o residencia', tone: 'plum' },
            { t: 'Estudio grabación', c: '29 espacios', s: 'Demo, EP o LP completo', tone: 'green' },
            { t: 'Luthier & alquiler', c: '20 espacios', s: 'Instrumentos y backline', tone: 'blue' },
          ].map((x, i) => (
            <div key={i} style={{ borderTop: `1px solid #3a332c`, paddingTop: 20 }}>
              <Meta items={[x.c]} style={{ color: T.accent, marginBottom: 14 }} />
              <div style={{ fontFamily: T.display, fontSize: 28, letterSpacing: -0.5, fontWeight: 600, lineHeight: 1.05 }}>{x.t}</div>
              <div style={{ fontSize: 12, color: '#9a9080', marginTop: 6 }}>{x.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PULL QUOTE */}
      <div style={{ padding: '90px 44px', background: T.paper2, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <Meta items={['TESTIMONIO', 'LAVAPIÉS']} style={{ justifyContent: 'center', marginBottom: 28 }} />
          <blockquote style={{
            fontFamily: T.display, fontSize: 60, lineHeight: 1.05, margin: 0, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: -1, color: T.ink,
          }}>
            “Seis meses buscando bajista en bares. En BandYou encontré a Marta en dos tardes.
            Ya ensayamos los <span style={{ color: T.accent, fontStyle: 'normal', fontWeight: 600 }}>miércoles</span>.”
          </blockquote>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 36 }}>
            <Avatar name="Iván Torres" tone="plum" size={44} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Iván Torres</div>
              <Meta items={['GUITARRA', 'POST-PUNK']} />
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER CTA */}
      <div style={{ padding: '100px 44px', background: T.ink, color: T.cream, position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 40, alignItems: 'end' }}>
          <h2 style={{ fontFamily: T.display, fontSize: 112, lineHeight: 0.88, margin: 0, letterSpacing: -3, fontWeight: 600 }}>
            Dale a <span style={{ fontStyle: 'italic', fontWeight: 400 }}>play.</span><br/>
            <span style={{ color: T.accent }}>La escena te espera.</span>
          </h2>
          <div>
            <p style={{ color: '#c9bfa4', fontSize: 15, lineHeight: 1.5, margin: 0 }}>
              Empezamos por Madrid. Después Barcelona, Valencia, Sevilla. Luego Europa.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <Btn variant="accent" size="lg" style={{ padding: '16px 30px', fontSize: 15 }}>Crear mi ficha</Btn>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 80, paddingTop: 28, borderTop: `1px solid #3a332c`, display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, color: '#8a8070', textTransform: 'uppercase' }}>
          <span>© BandYou · Madrid, 2026</span>
          <span>Hecho con disquera de la calle Libertad</span>
          <span>Privacidad · Términos · Prensa</span>
        </div>
      </div>
    </div>
  );
}
window.Landing = Landing;
