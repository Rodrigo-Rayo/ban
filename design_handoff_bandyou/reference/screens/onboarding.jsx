// Onboarding flow for BandYou
const T = window.BY_TOKENS;

function Onboarding() {
  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState('musician');
  const [instruments, setInstruments] = React.useState(['Guitarra']);
  const [styles, setStyles] = React.useState(['Indie', 'Post-punk']);
  const [level, setLevel] = React.useState(3);

  const steps = ['Rol', 'Instrumento', 'Estilo', 'Nivel', 'Zona', 'Listo'];

  const Frame = ({ children }) => (
    <div style={{
      background: T.paper, minHeight: '100%', fontFamily: T.sans, color: T.ink,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.line}` }}>
        <Wordmark size={20} />
        <Meta items={[`PASO ${String(step+1).padStart(2,'0')} / 06`, steps[step].toUpperCase()]} />
        <button onClick={() => setStep(Math.max(0, step-1))} style={{ background: 'none', border: 'none', fontFamily: T.mono, fontSize: 11, letterSpacing: 1, cursor: 'pointer', color: T.muted, textTransform: 'uppercase' }}>← Atrás</button>
      </div>
      {/* progress */}
      <div style={{ display: 'flex', height: 3 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ flex: 1, background: i <= step ? T.accent : T.line, borderRight: i < 5 ? `1px solid ${T.paper}` : 'none' }} />
        ))}
      </div>
      <div style={{ flex: 1, padding: '48px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </div>
      <div style={{ padding: '20px 40px', borderTop: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Meta items={['PUEDES EDITAR TODO MÁS TARDE']} />
        <Btn variant="accent" size="lg" onClick={() => setStep(Math.min(5, step+1))} icon={Icons.arrow(14)}>
          {step === 5 ? 'Entrar' : 'Siguiente'}
        </Btn>
      </div>
    </div>
  );

  const Choice = ({ items, selected, onSelect, multi = false, cols = 2 }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
      {items.map(it => {
        const label = typeof it === 'string' ? it : it.label;
        const desc = typeof it === 'string' ? null : it.desc;
        const active = multi ? selected.includes(label) : selected === label;
        return (
          <button key={label} onClick={() => {
            if (multi) onSelect(active ? selected.filter(s => s !== label) : [...selected, label]);
            else onSelect(label);
          }} style={{
            padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
            background: active ? T.ink : T.white, color: active ? T.paper : T.ink,
            border: `1px solid ${active ? T.ink : T.line2}`, borderRadius: 2,
            fontFamily: T.sans, transition: 'all 0.15s',
          }}>
            <div style={{ fontFamily: T.serif, fontSize: 20, letterSpacing: -0.3 }}>{label}</div>
            {desc && <div style={{ fontSize: 12, color: active ? '#c9c1b4' : T.muted, marginTop: 4 }}>{desc}</div>}
          </button>
        );
      })}
    </div>
  );

  if (step === 0) return (
    <Frame>
      <h2 style={{ fontFamily: T.serif, fontSize: 52, lineHeight: 1, margin: 0, letterSpacing: -1, fontWeight: 400 }}>
        ¿Quién <span style={{ fontStyle: 'italic', color: T.accent }}>eres</span>?
      </h2>
      <p style={{ color: T.muted, fontSize: 14, margin: '12px 0 32px' }}>Puedes ser varias cosas. Elige la principal.</p>
      <Choice cols={2} selected={role} onSelect={setRole} items={[
        { label: 'Músico', desc: 'Busco banda, proyectos o jams.' },
        { label: 'Banda', desc: 'Buscamos miembros o bolos.' },
        { label: 'Profesor', desc: 'Doy clases particulares o en escuela.' },
        { label: 'Local de ensayo', desc: 'Alquilo salas por horas o mes.' },
      ]} />
    </Frame>
  );

  if (step === 1) return (
    <Frame>
      <h2 style={{ fontFamily: T.serif, fontSize: 52, lineHeight: 1, margin: 0, letterSpacing: -1, fontWeight: 400 }}>
        ¿Qué <span style={{ fontStyle: 'italic', color: T.accent }}>tocas</span>?
      </h2>
      <p style={{ color: T.muted, fontSize: 14, margin: '12px 0 32px' }}>Elige todos los que te apliquen.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['Guitarra', 'Bajo', 'Batería', 'Voz', 'Teclados', 'Piano', 'Violín', 'Saxo', 'Trompeta', 'DJ / Producción', 'Percusión', 'Contrabajo', 'Armónica', 'Ukelele', 'Cello'].map(inst => {
          const active = instruments.includes(inst);
          return (
            <button key={inst} onClick={() => setInstruments(active ? instruments.filter(i => i !== inst) : [...instruments, inst])} style={{
              padding: '10px 16px', cursor: 'pointer', borderRadius: 24,
              background: active ? T.accent : 'transparent', color: active ? T.paper : T.ink,
              border: `1px solid ${active ? T.accent : T.line2}`, fontFamily: T.sans, fontSize: 14,
            }}>{inst}</button>
          );
        })}
      </div>
    </Frame>
  );

  if (step === 2) return (
    <Frame>
      <h2 style={{ fontFamily: T.serif, fontSize: 52, lineHeight: 1, margin: 0, letterSpacing: -1, fontWeight: 400 }}>
        ¿Qué <span style={{ fontStyle: 'italic', color: T.accent }}>suena</span>?
      </h2>
      <p style={{ color: T.muted, fontSize: 14, margin: '12px 0 32px' }}>Estilos e influencias. Hasta 5.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['Rock', 'Indie', 'Post-punk', 'Jazz', 'Metal', 'Pop', 'Hip-hop', 'Flamenco', 'Funk', 'Soul', 'Blues', 'Electrónica', 'Clásica', 'Reggae', 'Hardcore', 'Folk', 'Experimental', 'Latin', 'Trap'].map(st => {
          const active = styles.includes(st);
          return (
            <button key={st} onClick={() => setStyles(active ? styles.filter(s => s !== st) : styles.length < 5 ? [...styles, st] : styles)} style={{
              padding: '10px 16px', cursor: 'pointer', borderRadius: 24,
              background: active ? T.ink : 'transparent', color: active ? T.paper : T.ink,
              border: `1px solid ${active ? T.ink : T.line2}`, fontFamily: T.sans, fontSize: 14,
            }}>{st}</button>
          );
        })}
      </div>
    </Frame>
  );

  if (step === 3) return (
    <Frame>
      <h2 style={{ fontFamily: T.serif, fontSize: 52, lineHeight: 1, margin: 0, letterSpacing: -1, fontWeight: 400 }}>
        ¿Qué <span style={{ fontStyle: 'italic', color: T.accent }}>nivel</span>?
      </h2>
      <p style={{ color: T.muted, fontSize: 14, margin: '12px 0 32px' }}>Sé honesto. Te emparejamos con gente en tu onda.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[
          { n: 1, label: 'Empezando', desc: 'Menos de 1 año' },
          { n: 2, label: 'Amateur', desc: '1-3 años' },
          { n: 3, label: 'Intermedio', desc: 'Defiendo repertorio' },
          { n: 4, label: 'Avanzado', desc: 'Bolos regulares' },
          { n: 5, label: 'Profesional', desc: 'Es mi trabajo' },
        ].map(lv => {
          const active = level === lv.n;
          return (
            <button key={lv.n} onClick={() => setLevel(lv.n)} style={{
              padding: '20px 12px', cursor: 'pointer', textAlign: 'left',
              background: active ? T.ink : T.white, color: active ? T.paper : T.ink,
              border: `1px solid ${active ? T.ink : T.line2}`, borderRadius: 2, fontFamily: T.sans,
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: active ? T.accent : T.muted, letterSpacing: 1.5 }}>LV.{lv.n}</div>
              <div style={{ fontFamily: T.serif, fontSize: 18, letterSpacing: -0.3, marginTop: 6 }}>{lv.label}</div>
              <div style={{ fontSize: 11, color: active ? '#c9c1b4' : T.muted, marginTop: 2 }}>{lv.desc}</div>
            </button>
          );
        })}
      </div>
    </Frame>
  );

  if (step === 4) return (
    <Frame>
      <h2 style={{ fontFamily: T.serif, fontSize: 52, lineHeight: 1, margin: 0, letterSpacing: -1, fontWeight: 400 }}>
        ¿Por dónde <span style={{ fontStyle: 'italic', color: T.accent }}>te mueves</span>?
      </h2>
      <p style={{ color: T.muted, fontSize: 14, margin: '12px 0 32px' }}>Hasta dónde estás dispuesto a ensayar.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32 }}>
        <div style={{ position: 'relative', height: 260, background: T.paper2, border: `1px solid ${T.line2}` }}>
          <svg viewBox="0 0 300 260" width="100%" height="100%" style={{ display: 'block' }}>
            <rect width="300" height="260" fill={T.paper2} />
            {/* grid */}
            {Array.from({ length: 10 }, (_, i) => (
              <g key={i}>
                <line x1={i * 30} y1="0" x2={i * 30} y2="260" stroke={T.line2} strokeWidth="0.5" opacity="0.4"/>
                <line x1="0" y1={i * 26} x2="300" y2={i * 26} stroke={T.line2} strokeWidth="0.5" opacity="0.4"/>
              </g>
            ))}
            {/* rings */}
            <circle cx="150" cy="130" r="40" fill={T.accent} opacity="0.15" stroke={T.accent} strokeDasharray="3 3"/>
            <circle cx="150" cy="130" r="80" fill={T.accent} opacity="0.08" stroke={T.accent} strokeDasharray="3 3"/>
            <circle cx="150" cy="130" r="120" fill={T.accent} opacity="0.04" stroke={T.accent} strokeDasharray="3 3"/>
            <circle cx="150" cy="130" r="4" fill={T.accent}/>
            <text x="150" y="150" textAnchor="middle" fontFamily={T.mono} fontSize="9" fill={T.ink} letterSpacing="1">MALASAÑA</text>
          </svg>
        </div>
        <div>
          <Meta items={['BASE', 'MADRID CENTRO']} style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: T.serif, fontSize: 36, letterSpacing: -0.5 }}>Malasaña</div>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>Cambia tu barrio cuando quieras.</div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 10, letterSpacing: 1, color: T.muted, marginBottom: 8 }}>
              <span>RADIO DE MOVIMIENTO</span><span style={{ color: T.accent }}>5 KM</span>
            </div>
            <div style={{ height: 3, background: T.line, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', background: T.accent }} />
              <div style={{ position: 'absolute', left: '30%', top: -5, width: 13, height: 13, background: T.ink, borderRadius: 7, transform: 'translateX(-50%)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: T.mono, color: T.muted, marginTop: 6 }}>
              <span>1 km</span><span>Madrid</span><span>Toda España</span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );

  return (
    <Frame>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, letterSpacing: 2, marginBottom: 16 }}>★ LISTO ★</div>
        <h2 style={{ fontFamily: T.serif, fontSize: 72, lineHeight: 0.95, margin: 0, letterSpacing: -1.2, fontWeight: 400 }}>
          Hola <span style={{ fontStyle: 'italic', color: T.accent }}>{role.toLowerCase()}</span>.<br/>
          Ya eres parte.
        </h2>
        <p style={{ color: T.muted, fontSize: 15, margin: '24px auto 32px', maxWidth: 460, lineHeight: 1.5 }}>
          Hemos encontrado <span style={{ color: T.accent, fontWeight: 600 }}>23 perfiles</span> cerca de ti. Una banda post-punk en Lavapiés busca alguien así.
        </p>
        <div style={{ display: 'inline-flex', gap: 10 }}>
          <Btn variant="accent" size="lg">Explorar directorio</Btn>
          <Btn variant="ghost" size="lg">Completar perfil</Btn>
        </div>
      </div>
    </Frame>
  );
}

window.Onboarding = Onboarding;
