// BandYou v2 — vinyl primitives
const T = window.BY_TOKENS;

// Vinyl record — the signature graphic
function Vinyl({ size = 160, label, sublabel, tone = 'amber', spin = false, children, style = {} }) {
  const labelColors = {
    amber: '#d9532b', plum: '#6b3d5c', green: '#4a6b3f', blue: '#3d4f6b', ink: '#1a1512', cream: '#e4d9c1',
  };
  const lc = labelColors[tone] || '#d9532b';
  const ringCount = 8;
  return (
    <div style={{ width: size, height: size, position: 'relative', ...style }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle at 48% 48%, #2a2620 0%, #141210 38%, #0a0908 80%)`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05), 0 4px 16px rgba(0,0,0,0.3)',
        position: 'relative', overflow: 'hidden',
        animation: spin ? 'vinyl-spin 8s linear infinite' : undefined,
      }}>
        {/* grooves */}
        {Array.from({ length: ringCount }, (_, i) => {
          const pct = 38 + (i / ringCount) * 58;
          return (
            <div key={i} style={{
              position: 'absolute', inset: `${(100 - pct) / 2}%`,
              borderRadius: '50%', border: '1px solid rgba(255,255,255,0.035)',
            }} />
          );
        })}
        {/* highlight */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'conic-gradient(from 210deg, transparent 0deg, rgba(255,255,255,0.06) 30deg, transparent 60deg, transparent 210deg, rgba(255,255,255,0.04) 240deg, transparent 270deg)',
        }} />
        {/* label */}
        <div style={{
          position: 'absolute', inset: '32%', borderRadius: '50%',
          background: lc, color: tone === 'cream' ? T.ink : T.cream,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 8, textAlign: 'center', overflow: 'hidden',
        }}>
          {children || (
            <>
              {label && <div style={{ fontFamily: T.display, fontSize: size * 0.09, fontWeight: 600, letterSpacing: -0.4, lineHeight: 1 }}>{label}</div>}
              {sublabel && <div style={{ fontFamily: T.mono, fontSize: size * 0.045, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4, opacity: 0.85 }}>{sublabel}</div>}
            </>
          )}
        </div>
        {/* center hole */}
        <div style={{
          position: 'absolute', inset: '48%', borderRadius: '50%',
          background: T.paper, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
        }} />
      </div>
      <style>{`@keyframes vinyl-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}

// Sleeve — album cover framing
function Sleeve({ children, tone = 'ink', style = {} }) {
  const bgs = {
    ink: `repeating-linear-gradient(0deg, ${T.ink} 0 2px, ${T.ink2} 2px 4px)`,
    amber: `repeating-linear-gradient(90deg, #d9532b 0 3px, #c74418 3px 6px)`,
    cream: `repeating-linear-gradient(45deg, ${T.paper2} 0 6px, ${T.paper} 6px 12px)`,
    plum: `repeating-linear-gradient(0deg, #6b3d5c 0 3px, #5a3250 3px 6px)`,
    green: `repeating-linear-gradient(90deg, #4a6b3f 0 3px, #3d5a34 3px 6px)`,
    blue: `repeating-linear-gradient(45deg, #3d4f6b 0 3px, #324258 3px 6px)`,
  };
  return (
    <div style={{
      background: bgs[tone] || bgs.ink,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 12px rgba(0,0,0,0.3)',
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Avatar({ name = '?', size = 40, tone = 'amber', style = {} }) {
  const bg = { amber: '#d9532b', plum: '#6b3d5c', green: '#4a6b3f', blue: '#3d4f6b', ink: '#1a1512', cream: '#e4d9c1' }[tone] || '#d9532b';
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: tone === 'cream' ? T.ink : T.cream,
      fontFamily: T.display, fontWeight: 600, fontSize: size * 0.4,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, letterSpacing: 0.5,
      boxShadow: 'inset 0 0 0 3px ' + T.paper + ', inset 0 0 0 4px ' + T.ink,
      ...style,
    }}>{initials}</div>
  );
}

function Tag({ children, active = false, variant = 'default', style = {} }) {
  const styles = {
    default: { bg: active ? T.ink : 'transparent', fg: active ? T.paper : T.ink2, bd: active ? T.ink : T.line2 },
    accent: { bg: T.accent, fg: T.cream, bd: T.accent },
    stamp: { bg: 'transparent', fg: T.accent, bd: T.accent },
  }[variant];
  return (
    <span style={{
      fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2,
      padding: '3px 8px', border: `1px solid ${styles.bd}`,
      background: styles.bg, color: styles.fg,
      display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500,
      ...style,
    }}>{children}</span>
  );
}

function Meta({ items = [], style = {} }) {
  return (
    <div style={{
      fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
      color: T.muted, display: 'flex', gap: 10, alignItems: 'center', ...style,
    }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ opacity: 0.4 }}>◆</span>}
          <span>{it}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// Rubber stamp — display number or badge
function Stamp({ children, rotate = -4, color = T.accent, style = {} }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '6px 14px',
      border: `2px solid ${color}`, color, fontFamily: T.cond, fontWeight: 500,
      textTransform: 'uppercase', letterSpacing: 2, fontSize: 11,
      transform: `rotate(${rotate}deg)`,
      background: 'transparent',
      ...style,
    }}>{children}</div>
  );
}

function CompatDots() { return null; }

function Wordmark({ size = 22, color = T.ink }) {
  return (
    <span style={{
      fontFamily: T.display, fontSize: size, color,
      fontWeight: 600, letterSpacing: -0.8, lineHeight: 1,
      display: 'inline-flex', alignItems: 'baseline',
    }}>
      band<span style={{ color: T.accent, fontStyle: 'italic', fontWeight: 400 }}>·</span>you
    </span>
  );
}

// Photo placeholder — striped, with mono caption
function PhotoPlaceholder({ label = 'photo', tone = 'warm', style = {}, children }) {
  const colors = {
    warm:  ['#d9c7a4', '#c4a87c'],
    cool:  ['#bcc7cf', '#9aadb9'],
    ink:   ['#2a2620', '#141210'],
    amber: ['#e5a466', '#c77e3a'],
    plum:  ['#8b5f7c', '#6b3d5c'],
    green: ['#8fa07c', '#6c7f5b'],
    blue:  ['#8294a8', '#5e7186'],
    cream: ['#ede4d0', '#d6c9ac'],
  }[tone] || ['#d9c7a4', '#c4a87c'];
  return (
    <div style={{
      background: `repeating-linear-gradient(135deg, ${colors[0]} 0 20px, ${colors[1]} 20px 40px)`,
      color: tone === 'ink' ? T.cream : T.ink2,
      fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
      display: 'flex', alignItems: 'flex-end', padding: 12,
      position: 'relative', overflow: 'hidden',
      ...style,
    }}>
      {children || <span style={{ opacity: 0.8 }}>[ {label} ]</span>}
    </div>
  );
}

const Icons = {
  search: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5"/><path d="m11 11 3.5 3.5" strokeLinecap="round"/></svg>,
  chat: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12v9H5l-3 3V3z" strokeLinejoin="round"/></svg>,
  map: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4l5-2 4 2 5-2v10l-5 2-4-2-5 2V4z" strokeLinejoin="round"/><path d="M6 2v12M10 4v12"/></svg>,
  calendar: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11"/><path d="M5 1v4M11 1v4M2 7h12"/></svg>,
  heart: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 14s-5-3.2-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 3.8-5 7-5 7z" strokeLinejoin="round"/></svg>,
  heartFill: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="currentColor"><path d="M8 14s-5-3.2-5-7a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 3.8-5 7-5 7z"/></svg>,
  home: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7l6-5 6 5v7H2V7z" strokeLinejoin="round"/><path d="M6 14v-4h4v4"/></svg>,
  bell: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6a4 4 0 0 1 8 0v4l1 2H3l1-2V6z" strokeLinejoin="round"/><path d="M7 14h2"/></svg>,
  user: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5.5" r="2.5"/><path d="M2.5 14c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5"/></svg>,
  pin: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 14s-4.5-4.5-4.5-8a4.5 4.5 0 0 1 9 0c0 3.5-4.5 8-4.5 8z"/><circle cx="8" cy="6" r="1.5"/></svg>,
  close: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 3 10 10M13 3 3 13" strokeLinecap="round"/></svg>,
  check: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  send: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m2 8 12-5-5 12-2-5-5-2z" strokeLinejoin="round"/></svg>,
  arrow: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  back: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 8H3m4-4-4 4 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  plus: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v12M2 8h12" strokeLinecap="round"/></svg>,
  star: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="currentColor"><path d="m8 1 2 5h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5z"/></svg>,
  compass: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="m10 6-3 1-1 3 3-1 1-3z" strokeLinejoin="round"/></svg>,
  vinyl: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="4"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>,
  ticket: (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 5v6l1 1v-1h12v1l1-1V5l-1-1v1H2V4L1 5z" strokeLinejoin="round"/></svg>,
};

function Btn({ children, variant = 'primary', size = 'md', icon, onClick, style = {} }) {
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '10px 18px', fontSize: 13 },
    lg: { padding: '14px 24px', fontSize: 14 },
  }[size];
  const variants = {
    primary: { background: T.ink, color: T.cream, border: `1px solid ${T.ink}` },
    accent:  { background: T.accent, color: T.cream, border: `1px solid ${T.accent}` },
    ghost:   { background: 'transparent', color: T.ink, border: `1px solid ${T.ink}` },
    text:    { background: 'transparent', color: T.ink, border: 'none', padding: 0 },
  }[variant];
  return (
    <button onClick={onClick} style={{
      ...sizes, ...variants,
      fontFamily: T.cond, fontWeight: 500, letterSpacing: 1.2, textTransform: 'uppercase',
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'all 0.15s',
      ...style,
    }}>
      {icon && icon}
      {children}
    </button>
  );
}

// ─── Shims ──────────────────
T.accentSoft = '#e88a5f';
T.plum = '#6b3d5c';
T.green = '#4a6b3f';
T.blue = '#3d4f6b';

// Extra icons used by v1 screens
Icons.play  = (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="currentColor"><path d="M4 3l9 5-9 5V3z"/></svg>;
Icons.pause = (s=16) => <svg width={s} height={s} viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>;

function MatchRing() { return null; }

// Waveform — simple bar render for sample playback
function Waveform({ progress = 0, bars = 48, height = 24 }) {
  const seed = (i) => Math.abs(Math.sin(i * 1.7 + 3)) * 0.7 + 0.3;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = seed(i) * height;
        const played = (i / bars) < progress;
        return <div key={i} style={{ width: 2, height: h, background: played ? T.accent : T.line2 }} />;
      })}
    </div>
  );
}

Object.assign(window, { Vinyl, Sleeve, Avatar, Tag, Meta, CompatDots, Stamp, Wordmark, PhotoPlaceholder, Icons, Btn, MatchRing, Waveform });
