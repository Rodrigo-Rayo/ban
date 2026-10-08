/* La Maqueta · fase 0 (laboratorio). Todo ocurre en el navegador: nada se sube a ningún servidor.
 * Graba partes de un bucle corto sobre lo ya grabado, las mezcla y genera un vídeo vertical.
 * Sincronía: la entrada del micro se captura en PCM con su marca de tiempo del AudioContext y
 * se recorta respecto al inicio del bucle + el retraso medido en la calibración (ida y vuelta).
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const CALIB_KEY = 'maqueta_calib_v1';
  const BLOCK = 2048;

  let ctx = null;
  let micStream = null;
  let micAec = null;           // echo cancellation of the open mic stream
  let ctxFresh = false;        // context re-created after the mic first opened (iOS)
  let capture = null;          // { chunks: [Float32Array], t0, on, level, clips }
  let tracks = [];             // { id, inst, who, raw, play, muted, offsetMs, base }
  let playing = [];            // live BufferSources of the transport
  let busy = false;
  let lastBlob = null;
  let calib = readCalib();
  const diag = { playbackTime: 'sin probar', lastRec: '—', mic: '—' };

  // ── song ────────────────────────────────────────────────────────────────
  const bpm = () => Math.min(180, Math.max(60, Number($('bpm').value) || 90));
  const bars = () => Number($('bars').value) || 4;
  const beatDur = () => 60 / bpm();
  const barDur = () => 4 * beatDur();
  const loopDur = () => bars() * barDur();

  function showLength() {
    $('len-status').textContent = `Bucle de ${loopDur().toFixed(1)} s · ${bars()} compases de 4/4`;
  }

  function readCalib() {
    try { const v = JSON.parse(localStorage.getItem(CALIB_KEY)); return typeof v?.s === 'number' ? v : null; } catch { return null; }
  }
  function saveCalib(v) { try { localStorage.setItem(CALIB_KEY, JSON.stringify(v)); } catch { /* private mode */ } }

  // ── audio setup ─────────────────────────────────────────────────────────
  async function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
    }
    if (ctx.state !== 'running') await ctx.resume();
    return ctx;
  }

  function releaseMic() {
    if (!micStream) return;
    micStream.getTracks().forEach(t => t.stop());
    const n = micStream._nodes;
    if (n) { try { n.src.disconnect(); n.proc.disconnect(); n.sink.disconnect(); } catch { /* gone */ } }
    micStream = null;
  }

  /** Raw mic (aec = false) for headphones and calibration; with echo cancellation to record without them. */
  async function ensureMic(aec) {
    if (micStream && micAec === aec && micStream.getAudioTracks()[0]?.readyState === 'live') return micStream;
    releaseMic();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: aec, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    // iPhone: opening the mic switches the audio session and can leave a context created
    // before it crackling or "robotic". Start a fresh one once the mic is open.
    if (!ctxFresh) {
      ctxFresh = true;
      stopAll();
      try { await ctx.close(); } catch { /* already closed */ }
      ctx = null;
      await ensureCtx();
    }
    micStream = stream;
    micAec = aec;
    const s = micStream.getAudioTracks()[0].getSettings();
    diag.mic = `${micStream.getAudioTracks()[0].label || 'micro'} · eco ${s.echoCancellation} · ruido ${s.noiseSuppression} · ganancia ${s.autoGainControl}` +
      (s.sampleRate ? ` · ${s.sampleRate} Hz` : '') + (s.latency !== undefined ? ` · lat ${(s.latency * 1000).toFixed(0)} ms` : '');
    const src = ctx.createMediaStreamSource(micStream);
    const proc = ctx.createScriptProcessor(BLOCK, 1, 1);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    proc.onaudioprocess = e => {
      if (!capture?.on) return;
      // One continuous timeline from the first block: per-block timestamps jitter.
      if (capture.t0 === null) {
        const hasPT = typeof e.playbackTime === 'number' && e.playbackTime > 0;
        diag.playbackTime = hasPT ? 'sí' : 'no (menos preciso)';
        capture.t0 = hasPT ? e.playbackTime : ctx.currentTime;
      }
      const d = new Float32Array(e.inputBuffer.getChannelData(0));
      let pk = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; if (a >= 0.99) capture.clips++; }
      capture.level = pk;
      capture.chunks.push(d);
    };
    src.connect(proc);
    proc.connect(sink);
    sink.connect(ctx.destination);
    // keep references alive
    micStream._nodes = { src, proc, sink };
    return micStream;
  }

  function startCapture() { capture = { chunks: [], t0: null, on: true, level: 0, clips: 0 }; }
  function stopCapture() { if (capture) capture.on = false; return capture; }

  /** Samples captured between `from` and `from + dur` (context time), zero where nothing arrived. */
  function slice(cap, from, dur) {
    const sr = ctx.sampleRate;
    const out = new Float32Array(Math.round(dur * sr));
    let covered = 0;
    let n = 0;
    for (const c of cap.chunks) {
      const i0 = Math.round((cap.t0 + n / sr - from) * sr);
      for (let k = 0; k < c.length; k++) {
        const i = i0 + k;
        if (i >= 0 && i < out.length) { out[i] = c[k]; covered++; }
      }
      n += c.length;
    }
    return { data: out, coverage: covered / out.length };
  }

  // ── sounds ──────────────────────────────────────────────────────────────
  function click(at, accent, gain = 0.35) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.05);
  }

  function noiseBuffer(c, secs) {
    const b = c.createBuffer(1, Math.ceil(secs * c.sampleRate), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /** 16 steps per bar: k = kick (kv volume), s = snare, g = ghost snare, h = hi-hat (hv volume),
   *  r = ride; swing pushes the off-beat eighths to the triplet (blues shuffle, jazz). */
  const STYLES = {
    rock:      { label: 'Rock',      k: [0, 8, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], hv: 0.2 },
    pop:       { label: 'Pop',       k: [0, 6, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], hv: 0.16 },
    funk:      { label: 'Funk',      k: [0, 3, 10], s: [4, 12], g: [7, 15], h: [...Array(16).keys()], hv: 0.1 },
    balada:    { label: 'Balada',    k: [0], s: [8], h: [0, 2, 4, 6, 8, 10, 12, 14], hv: 0.1 },
    blues:     { label: 'Blues',     k: [0, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], hv: 0.16, swing: true },
    jazz:      { label: 'Jazz',      k: [0, 4, 8, 12], kv: 0.25, s: [], h: [4, 12], hv: 0.08, r: [0, 4, 6, 8, 12, 14], swing: true },
  };
  const styleKey = () => $('style').value;

  /** The base beat of the chosen style, rendered offline. */
  async function renderDrums() {
    const st = STYLES[styleKey()] || STYLES.rock;
    const sr = ctx.sampleRate;
    const oc = new OfflineAudioContext(1, Math.round(loopDur() * sr), sr);
    const noise = noiseBuffer(oc, 0.3);
    const eighth = beatDur() / 2;
    const kick = (t, v) => {
      const o = oc.createOscillator(); const g = oc.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(oc.destination); o.start(t); o.stop(t + 0.4);
    };
    const snare = (t, v) => {
      const n = oc.createBufferSource(); n.buffer = noise;
      const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
      const g = oc.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(f).connect(g).connect(oc.destination); n.start(t); n.stop(t + 0.2);
      const o = oc.createOscillator(); const g2 = oc.createGain(); o.type = 'triangle'; o.frequency.value = 190;
      g2.gain.setValueAtTime(v / 2, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g2).connect(oc.destination); o.start(t); o.stop(t + 0.1);
    };
    const hat = (t, v) => {
      const n = oc.createBufferSource(); n.buffer = noise;
      const f = oc.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = oc.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      n.connect(f).connect(g).connect(oc.destination); n.start(t); n.stop(t + 0.06);
    };
    const ride = t => {
      const n = oc.createBufferSource(); n.buffer = noise;
      const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 1.2;
      const g = oc.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      n.connect(f).connect(g).connect(oc.destination); n.start(t); n.stop(t + 0.3);
    };
    const step = eighth / 2;
    for (let b = 0; b < bars(); b++) {
      for (let e = 0; e < 16; e++) {
        // swung off-beat eighth: from half a beat to two thirds of it
        const t = b * barDur() + e * step + (st.swing && e % 4 === 2 ? beatDur() / 6 : 0);
        if (st.h.includes(e)) hat(t, e % 4 === 0 ? st.hv * 1.4 : st.hv);
        if (st.r?.includes(e)) ride(t);
        if (st.k.includes(e)) kick(t, st.kv ?? 0.9);
        if (st.s.includes(e)) snare(t, 0.6);
        if (st.g?.includes(e)) snare(t, 0.15);
      }
    }
    return oc.startRendering();
  }

  // ── tracks ──────────────────────────────────────────────────────────────
  /** Circular shift (the content is a loop), positive = later. */
  function shifted(raw, ms) {
    const n = raw.length;
    const s = Math.round((ms / 1000) * raw.sampleRate) % n;
    if (!s) return raw;
    const out = ctx.createBuffer(1, n, raw.sampleRate);
    const a = raw.getChannelData(0), b = out.getChannelData(0);
    for (let i = 0; i < n; i++) b[(i + s + n) % n] = a[i];
    return out;
  }

  function addTrack(t) {
    const track = { id: Math.random().toString(36).slice(2), muted: false, offsetMs: 0, ...t, play: t.raw };
    if (t.base) tracks.unshift(track); else tracks.push(track);
    lockSong();
    renderTracks();
  }

  function lockSong() {
    const locked = tracks.some(t => !t.base);
    for (const id of ['bpm', 'bars', 'tap']) $(id).disabled = locked;
    if (locked) $('len-status').textContent = `Bucle de ${loopDur().toFixed(1)} s · tempo bloqueado (ya hay partes grabadas; recarga para empezar otra)`;
  }

  function drawWave(canvas, buf) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext('2d');
    const d = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(d.length / w));
    g.fillStyle = '#c23a1f';
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let i = x * step; i < (x + 1) * step && i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
      const bh = Math.max(1, m * h);
      g.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }

  function renderTracks() {
    const ul = $('tracks');
    ul.innerHTML = '';
    for (const t of tracks) {
      const li = document.createElement('li');
      li.className = 'track';
      li.innerHTML = `
        <div class="head">
          <span class="inst"></span>
          <button type="button" data-a="solo" aria-label="Escuchar solo esta parte">▶</button>
          <button type="button" data-a="mute"></button>
          <button type="button" data-a="del" aria-label="Quitar">✕</button>
        </div>
        <span class="who"></span>
        <canvas class="wave"></canvas>
        ${t.base ? '' : `<label class="offset">Ajuste <input type="range" min="-150" max="150" step="5" value="${t.offsetMs}"><span>${t.offsetMs} ms</span></label>`}`;
      li.querySelector('.inst').textContent = t.inst;
      li.querySelector('.who').textContent = t.base ? 'Base de BandYou (puedes silenciarla)' : (t.who || 'Sin nombre');
      const mute = li.querySelector('[data-a="mute"]');
      mute.textContent = t.muted ? 'OFF' : 'ON';
      mute.classList.toggle('muted', t.muted);
      mute.setAttribute('aria-label', t.muted ? 'Activar' : 'Silenciar');
      mute.addEventListener('click', () => { t.muted = !t.muted; restartIfPlaying(); renderTracks(); });
      li.querySelector('[data-a="del"]').addEventListener('click', () => { tracks = tracks.filter(x => x !== t); stopAll(); renderTracks(); lockSong(); });
      li.querySelector('[data-a="solo"]').addEventListener('click', () => playAll([t]));
      const range = li.querySelector('input[type=range]');
      if (range) {
        range.addEventListener('input', () => { li.querySelector('.offset span').textContent = `${range.value} ms`; });
        range.addEventListener('change', () => { t.offsetMs = Number(range.value); t.play = shifted(t.raw, t.offsetMs); restartIfPlaying(); });
      }
      ul.appendChild(li);
      requestAnimationFrame(() => drawWave(li.querySelector('.wave'), t.play));
    }
  }

  // ── polish: the "studio" chain ──────────────────────────────────────────
  /** Short room/plate impulse: decaying noise, darker as it fades. */
  let irCache = null;
  function impulse(c) {
    if (irCache && irCache.sampleRate === c.sampleRate) return irCache;
    const len = Math.round(c.sampleRate * 1.6);
    const ir = c.createBuffer(1, len, c.sampleRate);
    const d = ir.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += (0.6 - 0.5 * t) * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, 3);
    }
    irCache = ir;
    return ir;
  }

  /**
   * Builds the mix bus on context `c` and returns `input(track)`: the node each track plays into.
   * Polished: recorded parts get a low cut, compression and make-up gain, everything shares a
   * little reverb, and a final compressor keeps the mix loud without clipping.
   */
  function mixBus(c, dest) {
    if (!$('polish').checked) return () => dest;
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -14; glue.ratio.value = 2.5; glue.attack.value = 0.02; glue.release.value = 0.25; glue.knee.value = 8;
    const out = c.createGain(); out.gain.value = 1.15;
    const limit = c.createDynamicsCompressor();
    limit.threshold.value = -3; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.1; limit.knee.value = 0;
    glue.connect(out); out.connect(limit); limit.connect(dest);
    const verb = c.createConvolver(); verb.buffer = impulse(c);
    const verbOut = c.createGain(); verbOut.gain.value = 0.35;
    verb.connect(verbOut); verbOut.connect(glue);
    return (t) => {
      const send = c.createGain();
      send.connect(verb);
      if (t.base) { send.gain.value = 0.08; const g = c.createGain(); g.connect(glue); g.connect(send); return g; }
      const bass = /bajo/i.test(t.inst || '');
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = bass ? 35 : 90; hp.Q.value = 0.7;
      const mud = c.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 300; mud.Q.value = 1; mud.gain.value = bass ? 0 : -3;
      const air = c.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 6000; air.gain.value = bass ? 0 : 2.5;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -24; comp.ratio.value = 3.5; comp.attack.value = 0.008; comp.release.value = 0.18; comp.knee.value = 10;
      const makeup = c.createGain(); makeup.gain.value = 1.6;
      hp.connect(mud); mud.connect(air); air.connect(comp); comp.connect(makeup);
      makeup.connect(glue);
      send.gain.value = /voz/i.test(t.inst || '') ? 0.3 : bass ? 0.05 : 0.2;
      makeup.connect(send);
      return hp;
    };
  }

  // ── transport ───────────────────────────────────────────────────────────
  function stopAll() {
    for (const s of playing) { try { s.stop(); } catch { /* already stopped */ } }
    playing = [];
    $('play').textContent = '▶ Escuchar todo';
  }

  /** The base beat of the chosen style (none = metronome only). */
  async function ensureBase() {
    if (styleKey() === 'none' || tracks.some(t => t.base)) return;
    addTrack({ inst: `Batería · ${STYLES[styleKey()].label}`, who: '', raw: await renderDrums(), base: true });
  }

  /** Style, tempo or length changed: the base follows (tempo only while nothing is recorded). */
  async function rebuildBase() {
    showLength();
    lockSong();
    if (!ctx) return;
    const wasPlaying = playing.length > 0;
    stopAll();
    tracks = tracks.filter(t => !t.base);
    await ensureBase();
    renderTracks();
    if (wasPlaying) playAll();
  }

  async function playAll(only) {
    await ensureCtx();
    if (!only) await ensureBase();
    const wasPlaying = playing.length > 0;
    stopAll();
    if (wasPlaying && !only) return;
    const list = (only || tracks).filter(t => only || !t.muted);
    if (!list.length) { $('rec-status').textContent = 'Aún no hay nada que escuchar: elige una base o graba la primera parte.'; return; }
    const at = ctx.currentTime + 0.08;
    const input = mixBus(ctx, ctx.destination);
    for (const t of list) {
      const s = ctx.createBufferSource();
      s.buffer = t.play; s.loop = true;
      s.connect(input(t)); s.start(at);
      playing.push(s);
    }
    $('play').textContent = '■ Parar';
  }

  function restartIfPlaying() { if (playing.length) { stopAll(); playAll(); } }

  // ── calibration ─────────────────────────────────────────────────────────
  async function calibrate() {
    if (busy) return;
    busy = true;
    stopAll();
    const st = $('calib-status');
    try {
      await ensureCtx(); await ensureMic(false);
      st.textContent = 'Escuchando… no toques nada';
      const t0 = ctx.currentTime + 0.4;
      const clicks = Array.from({ length: 6 }, (_, i) => t0 + 0.5 + i * 0.6);
      startCapture();
      clicks.forEach(t => click(t, true, 0.9));
      await wait((clicks.at(-1) + 0.7 - ctx.currentTime) * 1000);
      const cap = stopCapture();
      const sr = ctx.sampleRate;
      const quiet = slice(cap, t0, 0.4).data;
      const noise = Math.sqrt(quiet.reduce((s, x) => s + x * x, 0) / Math.max(1, quiet.length));
      const thr = Math.max(0.03, noise * 8);
      const found = [];
      for (const t of clicks) {
        const w = slice(cap, t - 0.02, 0.5).data;
        const i = w.findIndex(x => Math.abs(x) > thr);
        if (i >= 0) found.push(i / sr - 0.02);
      }
      found.sort((a, b) => a - b);
      const med = found[Math.floor(found.length / 2)];
      const spread = found.length ? found.at(-1) - found[0] : 1;
      if (found.length < 4 || spread > 0.03) {
        st.textContent = `No se oyeron bien los clics (${found.length}/6). Sube el volumen, quita los cascos y el modo silencio, y repite.`;
      } else {
        calib = { s: med, n: found.length, spreadMs: Math.round(spread * 1000), at: new Date().toISOString() };
        saveCalib(calib);
        st.textContent = `Listo: retraso del móvil ${Math.round(med * 1000)} ms (${found.length}/6 clics, variación ${calib.spreadMs} ms)`;
      }
    } catch (e) {
      st.textContent = micError(e);
    } finally {
      busy = false;
      updateDiag();
    }
  }

  // ── recording ───────────────────────────────────────────────────────────
  // ── bleed removal (recording without headphones) ────────────────────────
  /**
   * The last bleedLag found the speaker clearly in the take. Measured: real bleed gives a
   * peak 0.4–0.7 high standing out ×17–50; no bleed ~0.02–0.1 and ×1.1–3 by chance.
   */
  const bleedIsClear = () => bleedLag.score > 0.2 && bleedLag.prominence > 6;
  /** In-place iterative radix-2 FFT (inverse when `inv`). */
  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (inv ? 2 : -2) * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ar = re[i + k + len / 2], ai = im[i + k + len / 2];
          const tr = ar * cr - ai * ci, ti = ar * ci + ai * cr;
          re[i + k + len / 2] = re[i + k] - tr; im[i + k + len / 2] = im[i + k] - ti;
          re[i + k] += tr; im[i + k] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
    if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  /** Exactly what the speaker played during the take (same rate as the capture). */
  async function renderReference(list, gain, length) {
    const oc = new OfflineAudioContext(1, length, ctx.sampleRate);
    const g = oc.createGain(); g.gain.value = gain; g.connect(oc.destination);
    for (const t of list) { const s = oc.createBufferSource(); s.buffer = t.play; s.connect(g); s.start(0); }
    return (await oc.startRendering()).getChannelData(0);
  }

  /**
   * Removes from the microphone take what the speaker was playing. We know that signal
   * exactly, so the speaker→mic path is estimated per frequency over the whole take
   * (H = Σ M·X* / Σ |X|²: the player's own sound is unrelated to it and averages out)
   * and the filtered reference is subtracted (STFT, √Hann analysis and synthesis, 75 % overlap: the windows add up to 2).
   */
  /**
   * How much later the speaker sound shows up in the take (seconds, −0.1…+0.5 s).
   * GCC-PHAT on a 1/4-rate copy: whitening makes the true delay a sharp peak even for
   * tonal, beat-repeating music. Sets bleedLag.score (peak height) and .prominence
   * (peak / best other peak) so callers can ignore an unclear answer.
   */
  function bleedLag(mic, ref) {
    const sr = ctx ? ctx.sampleRate : 48000, D = 4;
    const len = Math.min(Math.floor(Math.min(mic.length, ref.length) / D), Math.round(8 * sr / D));
    let n = 1; while (n < 2 * len) n <<= 1;
    const mr = new Float64Array(n), mi = new Float64Array(n), xr = new Float64Array(n), xi = new Float64Array(n);
    for (let i = 0; i < len; i++) {
      let a = 0, b = 0;
      for (let k = 0; k < D; k++) { a += mic[i * D + k]; b += ref[i * D + k]; }
      mr[i] = a; xr[i] = b;
    }
    fft(mr, mi, false); fft(xr, xi, false);
    for (let k = 0; k < n; k++) {
      const cr = mr[k] * xr[k] + mi[k] * xi[k], ci = mi[k] * xr[k] - mr[k] * xi[k];
      const mag = Math.hypot(cr, ci) + 1e-12;
      mr[k] = cr / mag; mi[k] = ci / mag;
    }
    fft(mr, mi, true);
    const lo = -Math.round(0.1 * sr / D), hi = Math.round(0.5 * sr / D), guard = Math.round(0.003 * sr / D);
    const val = l => mr[(l + n) % n];
    let best = 0, bestV = -Infinity;
    for (let l = lo; l <= hi; l++) { const v = val(l); if (v > bestV) { bestV = v; best = l; } }
    let second = 1e-12;
    for (let l = lo; l <= hi; l++) if (Math.abs(l - best) > guard) second = Math.max(second, val(l));
    bleedLag.score = bestV;
    bleedLag.prominence = bestV / second;
    return best * D / sr;
  }

  async function removeBleed(mic, ref, onProgress) {
    // Line the reference up with where it really landed in the take (calibration or not),
    // so the per-frequency model only has to cover the room, not the device delay.
    const sr = ctx ? ctx.sampleRate : 48000;
    const lagS = Math.round(bleedLag(mic, ref) * sr);
    // No clear trace of the speaker in the take: there is nothing to remove, and a model
    // fitted to noise would only dull the player's sound.
    if (!bleedIsClear()) return { data: mic, reducedDb: 0, lagMs: 0, skipped: true };
    if (lagS) {
      const moved = new Float32Array(ref.length);
      for (let i = 0; i < ref.length; i++) { const j = i - lagS; moved[i] = j >= 0 && j < ref.length ? ref[j] : 0; }
      ref = moved;
    }
    const N = 2048, HOP = 512, B = N / 2 + 1;
    const SUPP = 0.5, SUPP_FLOOR = 0.2;
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    const frames = Math.max(1, Math.ceil((mic.length + N) / HOP));
    const at = (a, i) => (i >= 0 && i < a.length ? a[i] : 0);
    const mr = new Float64Array(N), mi = new Float64Array(N), xr = new Float64Array(N), xi = new Float64Array(N);
    const load = (f) => {
      const o = f * HOP - N;
      for (let i = 0; i < N; i++) { mr[i] = at(mic, o + i) * win[i]; xr[i] = at(ref, o + i) * win[i]; mi[i] = 0; xi[i] = 0; }
      fft(mr, mi, false); fft(xr, xi, false);
    };
    const sr_ = new Float64Array(B), si_ = new Float64Array(B), sxx = new Float64Array(B);
    for (let f = 0; f < frames; f++) {
      load(f);
      for (let k = 0; k < B; k++) {
        sr_[k] += mr[k] * xr[k] + mi[k] * xi[k];
        si_[k] += mi[k] * xr[k] - mr[k] * xi[k];
        sxx[k] += xr[k] * xr[k] + xi[k] * xi[k];
      }
      if (f % 64 === 0) { onProgress(f / frames / 2); await wait(0); }
    }
    let mean = 0; for (let k = 0; k < B; k++) mean += sxx[k]; mean /= B;
    const hr = new Float64Array(B), hi = new Float64Array(B);
    for (let k = 0; k < B; k++) { const d = sxx[k] + mean * 1e-3 + 1e-12; hr[k] = sr_[k] / d; hi[k] = si_[k] / d; }
    const out = new Float32Array(mic.length);
    let before = 0, after = 0;
    for (let f = 0; f < frames; f++) {
      load(f);
      for (let k = 0; k < B; k++) {
        const yr = hr[k] * xr[k] - hi[k] * xi[k], yi = hr[k] * xi[k] + hi[k] * xr[k];
        let er = mr[k] - yr, ei = mi[k] - yi;
        // What the linear model misses (speaker distortion) is turned down where the
        // predicted bleed dominates the bin; the player's own sound is left alone.
        const pe = er * er + ei * ei, py = yr * yr + yi * yi;
        const g = Math.max(SUPP_FLOOR, 1 - SUPP * py / (pe + 1e-12));
        er *= g; ei *= g;
        mr[k] = er; mi[k] = ei;
        if (k > 0 && k < B - 1) { mr[N - k] = er; mi[N - k] = -ei; }
      }
      fft(mr, mi, true);
      const o = f * HOP - N;
      for (let i = 0; i < N; i++) { const j = o + i; if (j >= 0 && j < out.length) out[j] += mr[i] * win[i] / 2; }
      if (f % 64 === 0) { onProgress(0.5 + f / frames / 2); await wait(0); }
    }
    for (let i = 0; i < mic.length; i++) { before += mic[i] * mic[i]; after += out[i] * out[i]; }
    return { data: out, reducedDb: 10 * Math.log10((before + 1e-12) / (after + 1e-12)), lagMs: Math.round(lagS / sr * 1000) };
  }

  // ── visual metronome ────────────────────────────────────────────────────
  function beatsView(t0, loopStart, end) {
    const cells = [...document.querySelectorAll('#beats span')];
    $('beats').hidden = false;
    let raf = 0;
    const frame = () => {
      const now = ctx.currentTime;
      const from = now < loopStart ? t0 : loopStart;
      const beat = Math.floor((now - from) / beatDur());
      cells.forEach((c, i) => {
        c.classList.toggle('on', now >= t0 && now < end && beat % 4 === i);
        c.classList.toggle('count', now < loopStart);
      });
      if (now < end) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); cells.forEach(c => c.classList.remove('on', 'count')); };
  }

  // ── wireless headphones ─────────────────────────────────────────────────
  const BT_RE = /bluetooth|airpods|buds|headset|hands-?free|manos libres|beats|\bbt\b|wh-1000|wf-1000|jabra|soundcore/i;
  let btWarned = false;
  /** Bluetooth headphones switch the phone to call quality and add delay: worth a warning. */
  async function bluetoothName() {
    try {
      const label = micStream?.getAudioTracks()[0]?.label || '';
      if (BT_RE.test(label)) return label;
      const devs = await navigator.mediaDevices.enumerateDevices();
      const hit = devs.find(d => d.kind === 'audiooutput' && d.deviceId === 'default' && BT_RE.test(d.label));
      return hit ? hit.label : '';
    } catch { return ''; }
  }

  // ── take review ─────────────────────────────────────────────────────────
  let pending = null;
  function showReview(take) {
    pending = take;
    $('review').hidden = false;
    $('rec').hidden = true;
    $('review').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function closeReview() {
    stopAll();
    pending = null;
    $('review').hidden = true;
    $('rec').hidden = false;
  }
  function keepTake() {
    if (!pending) return;
    const t = pending;
    closeReview();
    addTrack(t);
    $('rec-status').textContent = 'Añadida a la tabla. Si va adelantada o atrasada, mueve su «Ajuste».';
  }
  function playPending(solo) {
    if (!pending) return;
    const take = { ...pending, play: pending.raw };
    playAll(solo ? [take] : [...tracks.filter(t => !t.muted), take]);
  }

  // ── recording ───────────────────────────────────────────────────────────
  async function record() {
    if (busy) return;
    busy = true;
    stopAll();
    const st = $('rec-status');
    const btn = $('rec');
    let stopBeats = () => {};
    try {
      const speaker = document.querySelector('input[name="mode"]:checked')?.value !== 'phones';
      await ensureCtx(); await ensureMic(false);
      const bt = await bluetoothName();
      diag.bt = bt || 'no detectados';
      if (bt && !btWarned) {
        btWarned = true;
        st.textContent = `Parece que tienes cascos inalámbricos conectados (${bt}). Desconéctalos y graba con el móvil solo: por Bluetooth suena fatal y va con retraso. Si no lo son, pulsa Grabar otra vez.`;
        return;
      }
      await ensureBase();
      const t0 = ctx.currentTime + 0.35;
      const loopStart = t0 + barDur();
      const end = loopStart + loopDur();
      // Count-in always; during the take the click only with headphones (through the
      // speaker it would land in the recording: the squares on screen keep time instead).
      for (let b = 0; b < 4; b++) click(t0 + b * beatDur(), b === 0);
      if (!speaker && $('click-on').checked) {
        for (let b = 0; b < bars() * 4; b++) click(loopStart + b * beatDur(), b % 4 === 0, 0.18);
      }
      const backing = tracks.filter(x => !x.muted);
      const backingGain = speaker ? Number($('rec-vol').value) || 0.6 : 1;
      const bus = ctx.createGain(); bus.gain.value = backingGain; bus.connect(ctx.destination);
      for (const t of backing) {
        const s = ctx.createBufferSource(); s.buffer = t.play; s.connect(bus); s.start(loopStart);
        playing.push(s);
      }
      startCapture();
      stopBeats = beatsView(t0, loopStart, end);
      btn.classList.add('on'); btn.disabled = true;
      const tick = setInterval(() => {
        const now = ctx.currentTime;
        if (now < loopStart) st.textContent = `Preparado… ${Math.ceil((loopStart - now) / beatDur())}`;
        else if (now < end) {
          const lvl = capture.level;
          const meter = '▮'.repeat(Math.min(8, Math.ceil(lvl * 8))).padEnd(8, '▯');
          st.textContent = `● Grabando · ${(end - now).toFixed(1)} s · ${meter}${lvl >= 0.99 ? ' ¡Demasiado alto!' : ''}`;
        }
      }, 80);
      await wait((end + 0.35 - ctx.currentTime) * 1000);
      clearInterval(tick);
      stopBeats();
      const cap = stopCapture();
      playing = [];
      const offset = calib ? calib.s : 0;
      let { data, coverage } = slice(cap, loopStart + offset, loopDur());
      const clipped = cap.clips / Math.max(1, data.length);
      let cleaned = '';
      if (speaker && backing.length) {
        st.textContent = 'Quitando lo que sonaba por el altavoz… 0%';
        const ref = await renderReference(backing, backingGain, data.length);
        // The speaker sound in the take tells the device's real round trip: put the take in time
        // with it (works without calibrating; also refines an old calibration).
        const lag = bleedLag(data, ref);
        const sure = bleedIsClear();
        if (sure && Math.abs(lag) > 0.003) ({ data, coverage } = slice(cap, loopStart + offset + lag, loopDur()));
        cleaned = sure
          ? ` · puesto a tiempo solo: ${Math.round((offset + lag) * 1000)} ms (fiabilidad ${bleedLag.score.toFixed(2)}, destaca x${bleedLag.prominence.toFixed(1)})`
          : ` · retraso no claro (fiabilidad ${bleedLag.score.toFixed(2)}, destaca x${bleedLag.prominence.toFixed(1)}): se usa la calibración`;
        const r = await removeBleed(data, ref, p => { st.textContent = `Quitando lo que sonaba por el altavoz… ${Math.round(p * 100)}%`; });
        data = r.data;
        cleaned += r.skipped ? ' · no se coló el altavoz: grabación sin tocar' : ` · altavoz quitado ${r.reducedDb.toFixed(1)} dB`;
      }
      let peak = 0;
      for (const x of data) peak = Math.max(peak, Math.abs(x));
      // Only a gentle lift for very quiet takes: boosting more brings up noise and harshness.
      const gain = peak > 0 && peak < 0.25 ? Math.min(2.5, 0.6 / peak) : 1;
      const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      const out = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) out[i] = Math.max(-1, Math.min(1, data[i] * gain));
      diag.lastRec = `${speaker ? `sin cascos (base al ${Math.round(backingGain * 100)}%)` : 'con cascos'}${cleaned} · cobertura ${(coverage * 100).toFixed(1)}% · pico ${peak.toFixed(2)} · saturado ${(clipped * 100).toFixed(2)}% · ganancia x${gain.toFixed(1)} · bloques ${cap.chunks.length}` + (calib ? '' : ' · SIN CALIBRAR');
      showReview({ inst: $('rec-inst').value, who: $('rec-name').value.trim(), raw: buf, base: false });
      st.textContent = clipped > 0.001
        ? 'El micro se saturó (por eso puede sonar distorsionado). Mejor repite alejándote un poco o tocando más suave.'
        : coverage < 0.97
        ? 'Se perdió audio por el camino (mira el diagnóstico). Escúchala antes de quedártela.'
        : 'Escúchala y decide.';
    } catch (e) {
      st.textContent = micError(e);
    } finally {
      stopBeats();
      btn.classList.remove('on'); btn.disabled = false;
      busy = false;
      updateDiag();
    }
  }

  function micError(e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return 'Sin permiso para el micro: actívalo en los ajustes del navegador para esta web.';
    if (e && e.name === 'NotFoundError') return 'No se encontró micrófono.';
    return 'Algo falló: ' + (e && e.message ? e.message : e);
  }

  // ── video export ────────────────────────────────────────────────────────
  const MIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const pickMime = () => (window.MediaRecorder ? MIMES.find(m => MediaRecorder.isTypeSupported(m)) : null) || '';

  function envelope(buf, fps) {
    const d = buf.getChannelData(0);
    const per = Math.floor(buf.sampleRate / fps);
    const env = [];
    let max = 0.0001;
    for (let i = 0; i < d.length; i += per) {
      let s = 0;
      for (let k = i; k < i + per && k < d.length; k++) s += d[k] * d[k];
      const v = Math.sqrt(s / per);
      env.push(v); max = Math.max(max, v);
    }
    return env.map(v => v / max);
  }

  function wrap(g, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = []; let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (line && g.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawPoster(g, t, active, envs, total) {
    const W = 1080, H = 1920, P = 90;
    g.fillStyle = '#f2ebdd'; g.fillRect(0, 0, W, H);
    g.save(); g.strokeStyle = 'rgba(20,18,16,0.035)'; g.lineWidth = 4;
    for (let x = -H; x < W; x += 50) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H * 0.62, 0); g.stroke(); }
    g.restore();
    g.fillStyle = '#c23a1f'; g.fillRect(0, 0, W, 22);
    let y = 300;
    g.textBaseline = 'alphabetic';
    g.font = '70px Anton'; g.fillStyle = '#141210'; g.fillText('BAND', P, y);
    const bw = g.measureText('BAND').width; g.fillStyle = '#c23a1f'; g.fillText('YOU', P + bw, y);
    y += 80;
    g.font = '700 32px JB, monospace'; g.fillStyle = '#c23a1f';
    g.fillText(`LA MAQUETA · ${bpm()} BPM`, P, y);
    y += 30;
    g.font = '150px Anton'; g.fillStyle = '#141210';
    const title = ($('title').value.trim() || 'Sin título').toUpperCase();
    let size = 150;
    let lines = wrap(g, title, W - 2 * P);
    while (lines.length > 2 && size > 80) { size -= 10; g.font = `${size}px Anton`; lines = wrap(g, title, W - 2 * P); }
    for (const l of lines.slice(0, 2)) { y += size * 1.02; g.fillText(l, P, y); }
    const chords = $('chords').value.trim();
    if (chords) { y += 64; g.font = '700 40px IS, sans-serif'; g.fillStyle = '#3d3830'; g.fillText(chords, P, y); }
    y += 60;
    const rowH = Math.min(170, (1480 - y) / Math.max(1, active.length));
    active.forEach((tr, i) => {
      const top = y + i * rowH;
      g.fillStyle = 'rgba(20,18,16,0.18)'; g.fillRect(P, top, W - 2 * P, 3);
      const lvl = envs[i][Math.floor((t % loopDur()) * 30)] || 0;
      g.fillStyle = '#c23a1f'; g.fillRect(P, top + rowH - 22, (W - 2 * P) * lvl, 10);
      g.font = `${Math.round(rowH * 0.42)}px Anton`; g.fillStyle = '#141210';
      g.fillText(tr.inst.toUpperCase(), P, top + rowH * 0.55);
      g.font = `700 ${Math.round(rowH * 0.26)}px IS, sans-serif`; g.fillStyle = '#3d3830';
      const who = tr.base ? 'BandYou' : (tr.who || 'Anónimo');
      g.fillText(who, W - P - g.measureText(who).width, top + rowH * 0.55);
    });
    g.fillStyle = '#141210'; g.fillRect(P, 1500, W - 2 * P, 6);
    g.fillStyle = '#c23a1f'; g.fillRect(P, 1500, (W - 2 * P) * Math.min(1, t / total), 6);
    g.font = '700 30px JB, monospace'; g.fillStyle = '#141210'; g.fillText('HECHO EN BANDYOU.ES', P, 1550);
  }

  async function exportVideo() {
    if (busy) return;
    const active = tracks.filter(t => !t.muted);
    if (!active.length) { $('export-status').textContent = 'Primero graba algo.'; return; }
    const mime = pickMime();
    if (!mime) { $('export-status').textContent = 'Este navegador no puede grabar vídeo (MediaRecorder).'; return; }
    busy = true;
    stopAll();
    $('export-actions').hidden = true;
    try {
      await ensureCtx();
      await document.fonts.ready;
      const total = loopDur() * 2;
      const sr = ctx.sampleRate;
      const oc = new OfflineAudioContext(1, Math.round((total + 0.3) * sr), sr);
      const input = mixBus(oc, oc.destination);
      for (const t of active) {
        const node = input(t);
        for (const at of [0, loopDur()]) { const s = oc.createBufferSource(); s.buffer = t.play; s.connect(node); s.start(at); }
      }
      const mix = await oc.startRendering();
      const md = mix.getChannelData(0);
      let peak = 0; for (const x of md) peak = Math.max(peak, Math.abs(x));
      if (peak > 0.98) for (let i = 0; i < md.length; i++) md[i] *= 0.98 / peak;
      const envs = active.map(t => envelope(t.play, 30));

      const canvas = $('poster');
      const g = canvas.getContext('2d');
      drawPoster(g, 0, active, envs, total);
      const vStream = canvas.captureStream(30);
      const dest = ctx.createMediaStreamDestination();
      const src = ctx.createBufferSource();
      src.buffer = mix; src.connect(dest); src.connect(ctx.destination);
      const stream = new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
      const parts = [];
      rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
      const done = new Promise(r => { rec.onstop = r; });
      rec.start(250);
      const startAt = ctx.currentTime + 0.1;
      src.start(startAt);
      $('export-status').textContent = 'Grabando el vídeo… no cambies de app';
      await new Promise(resolve => {
        const frame = () => {
          const t = Math.max(0, ctx.currentTime - startAt);
          drawPoster(g, t, active, envs, total);
          if (t < total + 0.2) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      rec.stop();
      await done;
      lastBlob = new Blob(parts, { type: mime.split(';')[0] });
      diag.lastExport = `${mime} · ${(lastBlob.size / 1024 / 1024).toFixed(2)} MB · ${total.toFixed(1)} s`;
      $('export-status').textContent = `Vídeo listo (${lastBlob.type.includes('mp4') ? 'MP4' : 'WebM'}, ${(lastBlob.size / 1024 / 1024).toFixed(1)} MB)`;
      $('export-actions').hidden = false;
    } catch (e) {
      $('export-status').textContent = 'No se pudo crear el vídeo: ' + (e && e.message ? e.message : e);
    } finally {
      busy = false;
      updateDiag();
    }
  }

  function fileName() {
    return 'maqueta-bandyou.' + (lastBlob && lastBlob.type.includes('mp4') ? 'mp4' : 'webm');
  }

  async function share() {
    if (!lastBlob) return;
    const file = new File([lastBlob], fileName(), { type: lastBlob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: 'Nuestra maqueta en BandYou · bandyou.es' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    download();
  }

  function download() {
    if (!lastBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(lastBlob);
    a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  // ── tap tempo ───────────────────────────────────────────────────────────
  let taps = [];
  function tap() {
    const now = performance.now();
    taps = taps.filter(t => now - t < 2500);
    taps.push(now);
    if (taps.length >= 3) {
      const gaps = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      $('bpm').value = Math.round(Math.min(180, Math.max(60, 60000 / avg)));
      rebuildBase();
    }
    $('tap').textContent = taps.length < 3 ? `Toca otra vez (${taps.length})` : `${$('bpm').value} BPM · sigue tocando`;
  }

  // ── diagnostics ─────────────────────────────────────────────────────────
  function updateDiag() {
    const lines = [
      `Navegador: ${navigator.userAgent}`,
      `Audio: ${ctx ? `${ctx.sampleRate} Hz · base ${((ctx.baseLatency || 0) * 1000).toFixed(0)} ms · salida ${((ctx.outputLatency || 0) * 1000).toFixed(0)} ms · ${ctx.state}` : 'sin iniciar'}`,
      `Micro: ${diag.mic}`,
      `Cascos inalámbricos: ${diag.bt || 'sin comprobar'}`,
      `Calibración: ${calib ? `${Math.round(calib.s * 1000)} ms (${calib.n}/6, ±${calib.spreadMs} ms)` : 'no hecha'}`,
      `Marca de tiempo del audio: ${diag.playbackTime}`,
      `Última grabación: ${diag.lastRec}`,
      `Vídeo: ${pickMime() || 'no soportado'}${diag.lastExport ? ` · último: ${diag.lastExport}` : ''}`,
      `Compartir archivos: ${navigator.canShare ? 'sí' : 'no'}`,
    ];
    $('diag').textContent = lines.join('\n');
  }

  const wait = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));

  // ── wire up ─────────────────────────────────────────────────────────────
  $('calib-btn').addEventListener('click', calibrate);
  $('rec').addEventListener('click', record);
  $('review-play').addEventListener('click', () => playPending(false));
  $('review-solo').addEventListener('click', () => playPending(true));
  $('review-keep').addEventListener('click', keepTake);
  $('review-redo').addEventListener('click', () => { closeReview(); record(); });
  $('polish').addEventListener('change', restartIfPlaying);
  const syncMode = () => { $('vol-box').hidden = document.querySelector('input[name="mode"]:checked')?.value === 'phones'; };
  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', syncMode));
  syncMode();
  $('play').addEventListener('click', () => playAll());
  $('export').addEventListener('click', exportVideo);
  $('share').addEventListener('click', share);
  $('download').addEventListener('click', download);
  $('tap').addEventListener('click', tap);
  $('bpm').addEventListener('change', rebuildBase);
  $('bars').addEventListener('change', rebuildBase);
  $('style').addEventListener('change', rebuildBase);
  if (calib) $('calib-status').textContent = `Ya calibrado en este móvil: ${Math.round(calib.s * 1000)} ms. Puedes repetirlo.`;
  showLength();
  updateDiag();
})();
